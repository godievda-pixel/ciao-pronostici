// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { createBsdModularProvider } from './bsd-modular-provider.mjs';
import { createModularActionRouter, isModularAction, MODULAR_ACTION_NAMES } from './modular-actions.mjs';
import { createModularRuntime } from './modular-runtime.mjs';

const SB_URL=Deno.env.get("SUPABASE_URL")??"";
const V5=`${SB_URL}/functions/v1/ciao-core-api-fast-v5`;
const MATCH_CENTER=`${SB_URL}/functions/v1/ciao-match-center-fast-v3`;
const BSD_KEY=Deno.env.get("BSD_API_KEY")??"";
const ALLOWED_ORIGINS=new Set([
  "https://godievda-pixel.github.io",
  "https://ciao-web-app.orderly-bulb.workers.dev",
  "https://ciao-web-app.ciao-web.workers.dev",
]);

function serviceKey(){
  const s=Deno.env.get("SUPABASE_SECRET_KEYS");
  if(s){
    try{
      const j=JSON.parse(s);
      if(typeof j?.default==="string")return j.default;
      const x=Object.values(j??{}).find(v=>typeof v==="string");
      if(x)return String(x);
    }catch{}
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
}

const db=createClient(SB_URL,serviceKey(),{auth:{persistSession:false}});

function cors(req){
  const origin=req.headers.get("origin")??"";
  return{
    "access-control-allow-origin":ALLOWED_ORIGINS.has(origin)?origin:"https://godievda-pixel.github.io",
    "access-control-allow-methods":"GET,POST,OPTIONS",
    "access-control-allow-headers":"content-type,x-telegram-init-data",
    "access-control-max-age":"86400",
    "vary":"Origin",
  };
}

const out=(req,x,s=200)=>new Response(JSON.stringify(x),{
  status:s,
  headers:{...cors(req),"content-type":"application/json; charset=utf-8","cache-control":"no-store"},
});

async function postJson(req,url,body){
  const response=await fetch(url,{
    method:"POST",
    headers:{
      "content-type":"application/json",
      "x-telegram-init-data":req.headers.get("x-telegram-init-data")??"",
    },
    body:JSON.stringify(body),
  });
  const payload=await response.json().catch(()=>({}));
  return{response,payload};
}

async function proxy(req,b){
  const {response,payload}=await postJson(req,V5,b);
  return{r:response,j:payload};
}

function telegramId(req){
  try{
    const p=new URLSearchParams(req.headers.get("x-telegram-init-data")??"");
    const u=JSON.parse(p.get("user")??"null");
    return Number(u?.id)||0;
  }catch{return 0;}
}

function team(t){
  return t?{
    id:Number(t.id),
    name:String(t.name??""),
    short_name:t.short_name??null,
    custom_emoji_id:t.custom_emoji_id??null,
  }:null;
}

function normalize(m){
  return{
    match_id:Number(m.id),
    id:Number(m.id),
    kickoff_at:m.kickoff_at??null,
    round_number:m?.round?.number??null,
    home:team(m.home),
    away:team(m.away),
    home_score:m.home_score??null,
    away_score:m.away_score??null,
    is_finished:!!m.is_finished,
    live_status:m.live_status??null,
    live_elapsed:m.live_elapsed??null,
    live_phase:m.live_phase??null,
  };
}

function resultForTeam(m,teamId){
  const home=Number(m?.home?.id)===Number(teamId);
  const gf=Number(home?m?.home_score:m?.away_score),ga=Number(home?m?.away_score:m?.home_score);
  return gf>ga?'W':gf<ga?'L':'D';
}

function withoutRoundBonus(payload){
  if(!payload||typeof payload!=="object")return payload;
  if(payload.rules&&typeof payload.rules==="object")payload.rules={...payload.rules,bonus_multiplier:1,bonus_per_round:0,bonus_enabled:false};
  if(payload.round_summary&&typeof payload.round_summary==="object")payload.round_summary={...payload.round_summary,bonus_selected:false,bonus_locked:true};
  payload.round_bonus={match_id:null,selected_at:null,updated_at:null,locked:true,can_choose:false,can_move:false,available_match_ids:[],disabled:true,removed:true};
  return payload;
}

async function eagerFavorite(req){
  const tid=telegramId(req);if(!tid)return null;
  const uq=await db.from("cp_users").select("favorite_team_id").eq("telegram_id",tid).maybeSingle();
  if(uq.error||!uq.data?.favorite_team_id)return null;
  const id=Number(uq.data.favorite_team_id);
  const [tq,mq]=await Promise.all([
    db.from("cp_teams").select("id,name,short_name,custom_emoji_id").eq("id",id).maybeSingle(),
    db.from("cp_matches").select("id,kickoff_at,home_score,away_score,is_finished,live_status,live_elapsed,live_phase,round:cp_rounds!cp_matches_round_fk(number),home:cp_teams!cp_matches_home_team_fk(id,name,short_name,custom_emoji_id),away:cp_teams!cp_matches_away_team_fk(id,name,short_name,custom_emoji_id)").or(`home_team_id.eq.${id},away_team_id.eq.${id}`).order("kickoff_at",{ascending:true,nullsFirst:false}),
  ]);
  if(tq.error||mq.error||!tq.data)return null;
  const all=(mq.data??[]).map(normalize);
  const finished=all.filter(x=>x.is_finished).sort((a,b)=>new Date(b.kickoff_at||0).getTime()-new Date(a.kickoff_at||0).getTime());
  const upcoming=all.filter(x=>!x.is_finished).sort((a,b)=>new Date(a.kickoff_at||8640000000000000).getTime()-new Date(b.kickoff_at||8640000000000000).getTime());
  const form=finished.slice(0,5).map(m=>({result:resultForTeam(m,id),match_id:m.id,home_team:m.home?.name??null,away_team:m.away?.name??null,home_score:m.home_score,away_score:m.away_score,kickoff_at:m.kickoff_at}));
  return{ok:true,team:team(tq.data),coverage:{overview:true},overview:{form,last_match:finished[0]??null,next_match:upcoming[0]??null}};
}

async function authenticatedContext(req){
  const base=await proxy(req,{action:"state"});
  if(!base.r.ok||!base.j?.ok)return{ok:false,response:out(req,base.j,base.r.status)};
  withoutRoundBonus(base.j);
  return{
    ok:true,
    state:base.j,
    user:base.j.user,
    userId:Number(base.j?.user?.id)||0,
  };
}

function modularRuntimeFor(req){
  const provider=createBsdModularProvider({apiKey:BSD_KEY,fetchImpl:fetch});
  const legacyPost=async body=>{
    const x=await proxy(req,body);
    if(!x.r.ok||x.j?.ok===false){
      const error=new Error(String(x.j?.error||`legacy_http_${x.r.status}`));
      error.status=x.r.status;
      throw error;
    }
    return x.j;
  };
  const matchCenterPost=async body=>{
    const x=await postJson(req,MATCH_CENTER,body);
    if(!x.response.ok||x.payload?.ok===false){
      const error=new Error(String(x.payload?.error||`match_center_http_${x.response.status}`));
      error.status=x.response.status;
      throw error;
    }
    return x.payload;
  };
  return createModularRuntime({db,provider,legacyPost,matchCenterPost});
}

async function modularAction(req,action,body){
  const context=await authenticatedContext(req);
  if(!context.ok)return context.response;
  const runtime=modularRuntimeFor(req);
  const router=createModularActionRouter(runtime);
  const data=await router(action,body,context);
  return out(req,{ok:true,data});
}

Deno.serve(async req=>{
  try{
    if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});
    if(req.method==="GET")return out(req,{
      ok:true,
      service:"Ciao Core API Fast v6",
      version:6,
      eager_favorite:true,
      round_bonus:false,
      modular_actions:MODULAR_ACTION_NAMES,
      modular_competitions:["serie_a","coppa_italia","ucl","uel","uecl"],
      cors_origins:[...ALLOWED_ORIGINS],
    });
    if(req.method!=="POST")return new Response("Method Not Allowed",{status:405,headers:cors(req)});

    const b=await req.json().catch(()=>({}));
    const action=String(b.action??"state");

    if(action==="set_round_bonus")return out(req,{ok:false,error:"Бонус x2 удалён из правил",code:"bonus_removed"},410);
    if(isModularAction(action))return await modularAction(req,action,b);

    if(action!=="state"){
      const x=await proxy(req,b);
      if(action==="prediction_rules"&&x.j?.rules)x.j.rules={...x.j.rules,bonus_multiplier:1,bonus_per_round:0,bonus_enabled:false};
      return out(req,x.j,x.r.status);
    }

    const baseP=proxy(req,b),favP=eagerFavorite(req).catch(()=>null);
    const [base,favorite]=await Promise.all([baseP,favP]);
    if(!base.r.ok||!base.j?.ok)return out(req,base.j,base.r.status);
    withoutRoundBonus(base.j);
    if(favorite)base.j.favorite_club_profile=favorite;
    return out(req,base.j,base.r.status);
  }catch(e){
    console.error("core_v6_error",e);
    const status=Number(e?.status);
    return out(req,{ok:false,error:e instanceof Error?e.message:String(e)},Number.isInteger(status)&&status>=400&&status<600?status:500);
  }
});
