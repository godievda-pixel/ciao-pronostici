const CHANNEL_USERNAME='@CiaoCalcio';
const AUTH_MAX_AGE_SECONDS=86400;
const CACHE_MS=30*60*1000;
const enc=new TextEncoder();
const memberCache=new Map();
const userCache=new Map();

export class TelegramAuthError extends Error{
  constructor(code,status=401){super(code);this.name='TelegramAuthError';this.code=code;this.status=status}
}

async function hmac(keyBytes,message){
  const key=await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(message)));
}
function hex(bytes){return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('')}
function timingSafeEqual(a,b){a=String(a);b=String(b);if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
function checkString(params){return [...params.entries()].map(([k,v])=>`${k}=${v}`).sort().join('\n')}

async function validateInitData(raw,botToken){
  if(!raw||!botToken)throw new TelegramAuthError('telegram_authorization_missing');
  const params=new URLSearchParams(raw),received=params.get('hash')||'';
  if(!received)throw new TelegramAuthError('telegram_hash_missing');
  params.delete('hash');
  const secret=await hmac(enc.encode('WebAppData'),botToken);
  let expected=hex(await hmac(secret,checkString(params)));
  let valid=timingSafeEqual(expected,received);
  if(!valid&&params.has('signature')){
    const legacy=new URLSearchParams(params);legacy.delete('signature');
    expected=hex(await hmac(secret,checkString(legacy)));
    valid=timingSafeEqual(expected,received);
  }
  if(!valid)throw new TelegramAuthError('telegram_signature_invalid');
  const authDate=Number(params.get('auth_date')||0);
  if(!authDate||Math.abs(Date.now()/1000-authDate)>AUTH_MAX_AGE_SECONDS)throw new TelegramAuthError('telegram_authorization_expired');
  const userRaw=params.get('user');
  if(!userRaw)throw new TelegramAuthError('telegram_user_missing');
  let user;try{user=JSON.parse(userRaw)}catch{throw new TelegramAuthError('telegram_user_invalid')}
  if(!Number.isSafeInteger(Number(user?.id))||Number(user.id)<=0)throw new TelegramAuthError('telegram_user_invalid');
  return user;
}

async function requireMembership(telegramId,botToken,fetchImpl){
  const cached=memberCache.get(telegramId);if(cached&&cached.expires>Date.now())return cached;
  let payload;
  try{
    const response=await fetchImpl(`https://api.telegram.org/bot${botToken}/getChatMember`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:CHANNEL_USERNAME,user_id:telegramId})});
    payload=await response.json();
  }catch{throw new TelegramAuthError('telegram_membership_unavailable',503)}
  const status=String(payload?.result?.status||'').toLowerCase();
  const allowed=payload?.ok===true&&['member','administrator','creator'].includes(status);
  if(!allowed)throw new TelegramAuthError('subscription_required',403);
  const result={allowed:true,status,expires:Date.now()+CACHE_MS};memberCache.set(telegramId,result);return result;
}

async function resolveUser(telegramUser,db){
  const tid=Number(telegramUser.id),cached=userCache.get(tid);if(cached&&cached.expires>Date.now())return cached.user;
  const display=[telegramUser.first_name,telegramUser.last_name].filter(Boolean).join(' ')||telegramUser.username||String(tid);
  const username=telegramUser.username??null;
  let q=await db.from('cp_users').select('id,telegram_id,display_name,username,is_active').eq('telegram_id',tid).maybeSingle();
  if(q.error)throw new TelegramAuthError('user_lookup_failed',500);
  let row=q.data;
  if(!row){
    q=await db.from('cp_users').insert({telegram_id:tid,username,display_name:display,is_active:true}).select('id,telegram_id,display_name,username,is_active').single();
    if(q.error)throw new TelegramAuthError('user_create_failed',500);row=q.data;
  }else if(row.display_name!==display||row.username!==username){
    q=await db.from('cp_users').update({display_name:display,username}).eq('id',row.id).select('id,telegram_id,display_name,username,is_active').single();
    if(q.error)throw new TelegramAuthError('user_update_failed',500);row=q.data;
  }
  if(row?.is_active===false)throw new TelegramAuthError('user_inactive',403);
  userCache.set(tid,{user:row,expires:Date.now()+CACHE_MS});return row;
}

export async function authorizeTelegramRequest(req,{db,botToken,fetchImpl=fetch}){
  const raw=String(req?.headers?.get?.('x-telegram-init-data')||'').trim();
  const telegramUser=await validateInitData(raw,String(botToken||''));
  await requireMembership(Number(telegramUser.id),String(botToken||''),fetchImpl);
  const user=await resolveUser(telegramUser,db);
  return {user,telegramUser};
}
