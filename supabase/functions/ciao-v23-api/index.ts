// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { createBsdModularProvider } from './bsd-modular-provider.mjs';
import { createMatchService } from './services/matches.mjs';
import { createPredictionRepository } from './repositories/predictions.mjs';
import { createPredictionService } from './services/predictions.mjs';
import { createRankingService } from './services/ranking.mjs';
import { createUserRepository } from './repositories/users.mjs';
import { createProfileService } from './services/profile.mjs';
import {
  createV23Router,
  corsHeaders,
  errorEnvelope,
  serviceMetadata,
  successEnvelope,
} from './router.mjs';

const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const BSD_KEY = Deno.env.get('BSD_API_KEY') ?? '';
const ENVIRONMENT = Deno.env.get('CIAO_ENVIRONMENT') ?? '';
const ALLOWED_ORIGINS = Deno.env.get('CIAO_ALLOWED_ORIGINS') ?? '';
const CHANNEL = '@CiaoCalcio';
const memberCache = new Map();
const BUNDLE_TTL_MS = 5 * 60 * 1000;
let bundleCache = null;

function serviceKey() {
  const source = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (source) {
    try {
      const parsed = JSON.parse(source);
      if (typeof parsed?.default === 'string') return parsed.default;
      const first = Object.values(parsed ?? {}).find(value => typeof value === 'string');
      if (first) return String(first);
    } catch {}
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

const db = createClient(SB_URL, serviceKey(), {auth:{persistSession:false}});
const rawProvider = createBsdModularProvider({apiKey:BSD_KEY,fetchImpl:fetch});

function responseHeaders(req, extra = {}) {
  const headers = corsHeaders(req.headers.get('origin') ?? '', ALLOWED_ORIGINS);
  for (const [key,value] of Object.entries(extra)) headers.set(key,value);
  return headers;
}

function json(req, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers:responseHeaders(req, {
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store',
    }),
  });
}

function safeEq(a,b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index=0; index<a.length; index++) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

async function hmac(keyBytes,message) {
  const key = await crypto.subtle.importKey('raw', keyBytes, {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}

function hex(bytes) {
  return [...bytes].map(value => value.toString(16).padStart(2,'0')).join('');
}

function checkString(params) {
  const values = [];
  for (const [key,value] of params.entries()) values.push(`${key}=${value}`);
  values.sort();
  return values.join('\n');
}

async function validateInitData(raw) {
  if (!TOKEN || !raw) throw Object.assign(new Error('telegram_auth_required'), {status:401});
  const params = new URLSearchParams(raw);
  const expected = params.get('hash') ?? '';
  if (!expected) throw Object.assign(new Error('telegram_hash_missing'), {status:401});
  params.delete('hash');

  const secret = await hmac(new TextEncoder().encode('WebAppData'), TOKEN);
  let valid = safeEq(hex(await hmac(secret, checkString(params))), expected);
  if (!valid && params.has('signature')) {
    const legacy = new URLSearchParams(params);
    legacy.delete('signature');
    valid = safeEq(hex(await hmac(secret, checkString(legacy))), expected);
  }
  if (!valid) throw Object.assign(new Error('invalid_telegram_signature'), {status:401});

  const authDate = Number(params.get('auth_date') ?? 0);
  if (!authDate || Math.abs(Date.now()/1000 - authDate) > 86400) {
    throw Object.assign(new Error('telegram_auth_expired'), {status:401});
  }

  const user = JSON.parse(params.get('user') ?? 'null');
  if (!user?.id) throw Object.assign(new Error('telegram_user_invalid'), {status:401});
  return user;
}

async function telegram(method, body = {}) {
  const response = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(body),
  });
  return await response.json().catch(() => ({ok:false}));
}

async function requireMembership(telegramId) {
  const cached = memberCache.get(telegramId);
  if (cached && cached.expires > Date.now()) return cached.allowed;
  const result = await telegram('getChatMember', {chat_id:CHANNEL,user_id:telegramId});
  const status = String(result?.result?.status ?? '').toLowerCase();
  const allowed = !!result?.ok && ['member','administrator','creator'].includes(status);
  memberCache.set(telegramId, {allowed,expires:Date.now() + (allowed ? 30*60*1000 : 5000)});
  return allowed;
}

async function requireTestAccess(telegramId) {
  if (ENVIRONMENT === 'production') return;
  const query = await db.from('cp_test_access')
    .select('telegram_id')
    .eq('telegram_id', telegramId)
    .maybeSingle();
  if (query.error) throw query.error;
  if (!query.data) throw Object.assign(new Error('test_access_required'), {status:403});
}

async function localizationLookup() {
  const query = await db.from('cp_team_localizations')
    .select('provider_team_id,name_ru,genitive_ru,dative_ru,prepositional_ru,aliases_ru');
  if (query.error) throw query.error;
  return new Map((query.data ?? []).map(row => [String(row.provider_team_id), row]));
}

async function dependencies() {
  if (bundleCache && bundleCache.expires > Date.now()) return bundleCache.value;
  const lookup = await localizationLookup();
  const matchService = createMatchService({provider:rawProvider,localizationLookup:lookup});
  const predictionRepository = createPredictionRepository({db});
  const predictionService = createPredictionService({matchService,predictionRepository});
  const rankingService = createRankingService({db,predictionRepository});
  const userRepository = createUserRepository({db});
  const profileService = createProfileService({
    userRepository,
    matchService,
    predictionRepository,
    rankingService,
  });
  const router = createV23Router({matchService,predictionService,rankingService,profileService});
  const value = {router,userRepository};
  bundleCache = {value,expires:Date.now()+BUNDLE_TTL_MS};
  return value;
}

async function authorize(req) {
  const tgUser = await validateInitData(req.headers.get('x-telegram-init-data') ?? '');
  const telegramId = Number(tgUser.id);
  await requireTestAccess(telegramId);
  if (!await requireMembership(telegramId)) {
    throw Object.assign(new Error('subscription_required'), {status:403});
  }
  const {userRepository} = await dependencies();
  const user = await userRepository.syncTelegramProfile(tgUser);
  return {tgUser,userId:Number(user.id)};
}

Deno.serve(async req => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {status:204,headers:responseHeaders(req)});
    }

    if (req.method === 'GET') {
      return json(req, serviceMetadata({CIAO_ENVIRONMENT:ENVIRONMENT}));
    }

    if (req.method !== 'POST') {
      return json(req, errorEnvelope(Object.assign(new Error('method_not_allowed'),{status:405})), 405);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? '');
    const context = await authorize(req);
    const {router} = await dependencies();
    const data = await router.dispatch(action, body, context);
    return json(req, successEnvelope(data));
  } catch (error) {
    console.error('ciao_v23_api_error', error);
    const status = Number(error?.status);
    return json(
      req,
      errorEnvelope(error),
      Number.isInteger(status) && status >= 400 && status < 600 ? status : 500,
    );
  }
});
