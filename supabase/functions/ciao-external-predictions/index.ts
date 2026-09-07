// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { authorizeTelegramRequest, TelegramAuthError } from './auth.mjs';
import { createExternalPredictionService, ExternalPredictionServiceError } from './service.mjs';
import { parseExternalMatchId, scorePrediction, toExternalMatchRow } from './domain.mjs';

const SB_URL=Deno.env.get('SUPABASE_URL')??'';
const BOT_TOKEN=Deno.env.get('TELEGRAM_BOT_TOKEN')??'';
const MATCHES_URL='https://ciao-web-app.ciao-web.workers.dev/api/cw22/matches';
const FEATURE_FLAG='external_predictions_v1';
const ALLOWED_ORIGINS=new Set(['https://godievda-pixel.github.io','https://ciao-web-app.orderly-bulb.workers.dev','https://ciao-web-app.ciao-web.workers.dev']);

function serviceKey(){const s=Deno.env.get('SUPABASE_SECRET_KEYS');if(s){try{const j=JSON.parse(s);if(typeof j?.default==='string')return j.default;const x=Object.values(j??{}).find(v=>typeof v==='string');if(x)return String(x)}catch{}}return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??''}
const db=createClient(SB_URL,serviceKey(),{auth:{persistSession:false}});

function cors(req,extra={}){const h=new Headers(extra),origin=req.headers.get('origin')??'';if(ALLOWED_ORIGINS.has(origin))h.set('access-control-allow-origin',origin);h.set('vary','Origin');h.set('access-control-allow-methods','GET,POST,OPTIONS');h.set('access-control-allow-headers','content-type,x-telegram-init-data,x-ciao-cron-token');h.set('access-control-max-age','86400');return h}
function out(req,body,status=200){return new Response(JSON.stringify(body),{status,headers:cors(req,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'})})}
function safeEqual(a,b){a=String(a??'');b=String(b??'');if(!a||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0}
function isoDate(y,m,d){return String(y).padStart(4,'0')+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0')}
function seasonRange(now=new Date()){const y=now.getUTCFullYear(),m=now.getUTCMonth()+1,start=m>=7?y:y-1;return{from:isoDate(start,7,1),to:isoDate(start+1,6,30)}}

async function fetchNormalizedMatches({competition,initData}){const r=seasonRange(new Date()),u=new URL(MATCHES_URL);u.searchParams.set('competition',competition);u.searchParams.set('from',r.from);u.searchParams.set('to',r.to);const response=await fetch(u,{headers:{accept:'application/json','x-telegram-init-data':String(initData||'internal-sync')},cache:'no-store'});const body=await response.json().catch(()=>({}));if(!response.ok||!body?.ok)throw new Error('matches_provider_failed');const matches=body?.data?.matches;return Array.isArray(matches)?matches:[]}

const repository={
  async featureEnabled(key=FEATURE_FLAG){if(key!==FEATURE_FLAG)return false;const q=await db.from('cp_feature_flags').select('enabled').eq('key',key).maybeSingle();if(q.error)throw q.error;return q.data?.enabled===true},
  async upsertMatches(matches){const rows=(Array.isArray(matches)?matches:[]).map(m=>toExternalMatchRow(m));if(!rows.length)return[];const q=await db.from('cp_external_matches').upsert(rows,{onConflict:'competition,provider_event_id'}).select('*');if(q.error)throw q.error;return q.data??[]},
  async listMatches(competition){const q=await db.from('cp_external_matches').select('*').eq('competition',competition).order('stage_order').order('kickoff_at').order('id');if(q.error)throw q.error;return q.data??[]},
  async findMatchesByCanonicalIds(matchIds){const parsed=(Array.isArray(matchIds)?matchIds:[]).map(parseExternalMatchId).filter(Boolean);if(!parsed.length)return[];const groups=new Map();for(const x of parsed){const a=groups.get(x.competition)??[];a.push(x.providerEventId);groups.set(x.competition,a)}const out=[];for(const [competition,ids] of groups){const q=await db.from('cp_external_matches').select('*').eq('competition',competition).in('provider_event_id',[...new Set(ids)]);if(q.error)throw q.error;out.push(...(q.data??[]))}return out},
  async listUserPredictions(userId,externalMatchIds){if(!externalMatchIds.length)return[];const q=await db.from('cp_external_predictions').select('id,user_id,external_match_id,home_score,away_score,points,base_points,calculated_at,updated_at').eq('user_id',userId).in('external_match_id',externalMatchIds);if(q.error)throw q.error;return q.data??[]},
  async upsertUserPredictions(rows){if(!rows.length)return 0;const q=await db.from('cp_external_predictions').upsert(rows,{onConflict:'user_id,external_match_id'});if(q.error)throw q.error;return rows.length},
  async scoringRules(){const q=await db.from('cp_scoring_rules').select('exact_score,correct_goal_difference,correct_outcome,miss').eq('id',1).single();if(q.error)throw q.error;return q.data},
  async settleFinishedMatch(externalMatchId,signature,result,rules){const mq=await db.from('cp_external_matches').select('id,result_signature').eq('id',externalMatchId).single();if(mq.error)throw mq.error;if(mq.data?.result_signature===signature)return{changed:false};const pq=await db.from('cp_external_predictions').select('user_id,external_match_id,home_score,away_score').eq('external_match_id',externalMatchId);if(pq.error)throw pq.error;const now=new Date().toISOString(),rows=(pq.data??[]).map(p=>{const pts=scorePrediction({homeScore:p.home_score,awayScore:p.away_score},result,rules);return{...p,base_points:pts,points:pts,calculated_at:now,updated_at:now}});if(rows.length){const uq=await db.from('cp_external_predictions').upsert(rows,{onConflict:'user_id,external_match_id'});if(uq.error)throw uq.error}const update=await db.from('cp_external_matches').update({result_signature:signature,finalized_at:now,synced_at:now}).eq('id',externalMatchId);if(update.error)throw update.error;return{changed:true}},
  async cronToken(){const envToken=String(Deno.env.get('CIAO_EXTERNAL_CRON_TOKEN')??'').trim();if(envToken)return envToken;const q=await db.rpc('ciao_external_cron_token');if(q.error)return'';return String(q.data??'').trim()},
};

const service=createExternalPredictionService({repository,fetchMatches:fetchNormalizedMatches});

Deno.serve(async req=>{try{if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});if(req.method==='GET')return out(req,{ok:true,service:'ciao-external-predictions',version:1});if(req.method!=='POST')return out(req,{ok:false,error:'method_not_allowed'},405);const body=await req.json().catch(()=>({})),action=String(body?.action??'state');if(action==='sync_due'){const supplied=req.headers.get('x-ciao-cron-token')??'',expected=await repository.cronToken();if(!safeEqual(supplied,expected))return out(req,{ok:false,error:'cron_unauthorized'},403);return out(req,{ok:true,data:await service.syncDue({initData:'internal-sync'})})}const auth=await authorizeTelegramRequest(req,{db,botToken:BOT_TOKEN,fetchImpl:fetch});const initData=req.headers.get('x-telegram-init-data')??'';if(action==='state')return out(req,{ok:true,data:await service.state({userId:Number(auth.user.id),competition:String(body?.competition??''),initData})});if(action==='save_predictions')return out(req,{ok:true,data:await service.savePredictions({userId:Number(auth.user.id),competition:String(body?.competition??''),predictions:body?.predictions,initData})});return out(req,{ok:false,error:'unknown_action'},400)}catch(error){if(error instanceof TelegramAuthError)return out(req,{ok:false,error:error.code},error.status);if(error instanceof ExternalPredictionServiceError)return out(req,{ok:false,error:error.code},error.status);console.error('external_predictions_error',error instanceof Error?error.name:'error');return out(req,{ok:false,error:'internal_error'},500)}});
