// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { buildUnifiedStandings } from './standings.mjs';

const SB_URL=Deno.env.get("SUPABASE_URL")??"";
const OLD=`${SB_URL}/functions/v1/ciao-core-api-fast`;
const LOCK_MS=15*60000;

function key(){
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

const db=createClient(SB_URL,key(),{auth:{persistSession:false}});
const ALLOWED_ORIGINS=new Set([
  "https://godievda-pixel.github.io",
  "https://ciao-web-app.orderly-bulb.workers.dev",
  "https://ciao-web-app.ciao-web.workers.dev",
]);

function cors(req:Request,extra:Record<string,string>={}){
  const h=new Headers(extra),origin=req.headers.get("origin")??"";
  if(ALLOWED_ORIGINS.has(origin))h.set("access-control-allow-origin",origin);
  h.set("vary","Origin");
  h.set("access-control-allow-methods","GET,POST,OPTIONS");
  h.set("access-control-allow-headers","content-type,x-telegram-init-data");
  h.set("access-control-max-age","86400");
  return h;
}

const out=(req:Request,x:any,s=200)=>new Response(JSON.stringify(x),{
  status:s,
  headers:cors(req,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}),
});

async function old(req:Request,b:any){
  const r=await fetch(OLD,{
    method:"POST",
    headers:{"content-type":"application/json","x-telegram-init-data":req.headers.get("x-telegram-init-data")??""},
    body:JSON.stringify(b),
  });
  const j=await r.json().catch(()=>({}));
  return {r,j};
}

async function auth(req:Request,round?:number){
  const x=await old(req,{action:"state",...(round?{round}:{})});
  if(!x.r.ok||!x.j?.ok)return{ok:false,response:out(req,x.j,x.r.status)};
  return{ok:true,state:x.j,user:x.j.user};
}

let ruleCache:any={x:null,e:0};
async function rules(){
  if(ruleCache.x&&ruleCache.e>Date.now())return ruleCache.x;
  const q=await db.from("cp_scoring_rules")
    .select("exact_score,correct_goal_difference,correct_outcome,miss")
    .eq("id",1)
    .single();
  if(q.error)throw q.error;
  ruleCache={x:{...q.data,deadline_minutes:15},e:Date.now()+300000};
  return ruleCache.x;
}

const open=(m:any)=>!m.is_finished&&(!m.kickoff_at||Date.now()<new Date(m.kickoff_at).getTime()-LOCK_MS);

function roundSummary(st:any){
  const ms=st?.round?.matches??[],op=ms.filter(open);
  return{
    total:ms.length,
    saved:ms.filter((m:any)=>m.prediction).length,
    remaining_open:op.filter((m:any)=>!m.prediction).length,
    open_total:op.length,
    closed_total:ms.length-op.length,
    nearest_deadline_at:op.map((m:any)=>m.deadline_at).filter(Boolean).sort()[0]??null,
  };
}

const cache=new Map<string,{x:any,e:number}>();

async function currentRoundKickoffAt(currentRound:number|null){
  if(!Number.isInteger(Number(currentRound))||Number(currentRound)<=1)return null;
  const rq=await db.from('cp_rounds').select('id').eq('number',Number(currentRound)).maybeSingle();
  if(rq.error)throw rq.error;
  if(!rq.data?.id)return null;
  const mq=await db.from('cp_matches').select('kickoff_at').eq('round_id',rq.data.id).order('kickoff_at',{ascending:true}).limit(1).maybeSingle();
  if(mq.error)throw mq.error;
  return mq.data?.kickoff_at??null;
}

async function standings(scope="overall",round:number|null=null,month:string|null=null,currentRound:number|null=null){
  const ck=[scope,round,month,currentRound].join(":"),cc=cache.get(ck);
  if(cc&&cc.e>Date.now())return cc.x;

  const [uq,pq,tq,rr,cutoff]=await Promise.all([
    db.from("cp_users").select("id,display_name,favorite_team_id").eq("is_active",true),
    db.from("cp_prediction_results_unified").select("user_id,competition,prediction_key,kickoff_at,serie_a_round_number,points,base_points").not("points","is",null),
    db.from("cp_teams").select("id,name,short_name,custom_emoji_id"),
    rules(),
    scope==='overall'?currentRoundKickoffAt(currentRound):Promise.resolve(null),
  ]);
  for(const q of [uq,pq,tq])if(q.error)throw q.error;

  const x=buildUnifiedStandings({
    users:uq.data??[],
    teams:tq.data??[],
    results:pq.data??[],
    exactScore:Number(rr.exact_score),
    scope,
    round,
    month,
    currentRound,
    currentRoundKickoffAt:cutoff,
  });
  x.rows=x.rows.slice(0,100);
  cache.set(ck,{x,e:Date.now()+10000});
  return x;
}

async function notifications(uid:number){
  const q=await db.from("cp_users")
    .select("deadline_reminders_enabled,lineup_notifications_enabled,kickoff_notifications_enabled,result_notifications_enabled")
    .eq("id",uid)
    .single();
  if(q.error)throw q.error;
  return{
    deadline:q.data.deadline_reminders_enabled!==false,
    lineup:!!q.data.lineup_notifications_enabled,
    kickoff:!!q.data.kickoff_notifications_enabled,
    result:!!q.data.result_notifications_enabled,
  };
}

async function state(req:Request,b:any){
  const a=await auth(req,Number(b?.round)||undefined);
  if(!a.ok)return a.response;
  const st=a.state,uid=Number(a.user.id);
  const [rs,adv,np]=await Promise.all([
    rules(),
    standings("overall",null,null,Number(st.selected_round)||1),
    notifications(uid),
  ]);
  const me=adv.rows.find((x:any)=>x.id===uid)??{points:0,exact:0,successful:0,calculated:0,streak:0,rank:adv.rows.length+1,trend:0};
  st.user.notifications=np;
  st.user.reminders=np.deadline;
  st.rules=rs;
  delete st.round_bonus;
  st.round_summary=roundSummary(st);
  st.standings=adv.rows;
  st.standings_meta={scope:"overall",updated_at:adv.updated_at};
  st.stats={...st.stats,points:me.points,exact:me.exact,successful:me.successful,calculated:me.calculated,streak:me.streak,rank:me.rank,trend:me.trend};
  return out(req,st);
}

async function scope(req:Request,b:any){
  const a=await auth(req);
  if(!a.ok)return a.response;
  const sc=["overall","round","month"].includes(String(b.scope))?String(b.scope):"overall";
  const cr=Number(b.current_round)||Number(a.state.selected_round)||1;
  const rn=sc==="round"?Number(b.round):null;
  const mo=sc==="month"?String(b.month??new Date().toISOString().slice(0,7)):null;
  if(sc==="round"&&(!Number.isInteger(rn)||rn<=0))return out(req,{ok:false,error:"Некорректный тур"},400);
  if(sc==="month"&&!/^\d{4}-\d{2}$/.test(mo!))return out(req,{ok:false,error:"Некорректный месяц"},400);
  const x=await standings(sc,rn,mo,cr);
  return out(req,{ok:true,standings:x.rows,standings_meta:{scope:x.scope,round:x.round,month:x.month,updated_at:x.updated_at}});
}

async function predictor(req:Request,b:any){
  const a=await auth(req);
  if(!a.ok)return a.response;
  const id=Number(b.user_id);
  if(!Number.isInteger(id)||id<=0)return out(req,{ok:false,error:"Некорректный пользователь"},400);
  const cr=Number(a.state.selected_round)||1,mo=new Date().toISOString().slice(0,7);
  const [o,r,m]=await Promise.all([
    standings("overall",null,null,cr),
    standings("round",cr,null,cr),
    standings("month",null,mo,cr),
  ]);
  const x=o.rows.find((z:any)=>z.id===id);
  if(!x)return out(req,{ok:false,error:"Пользователь не найден"},404);
  const xr=r.rows.find((z:any)=>z.id===id),xm=m.rows.find((z:any)=>z.id===id);
  return out(req,{ok:true,predictor:{
    id:x.id,
    display_name:x.display_name,
    favorite_team:x.favorite_team,
    overall:{rank:x.rank,points:x.points,exact:x.exact,successful:x.successful,calculated:x.calculated,streak:x.streak,trend:x.trend},
    round:{number:cr,rank:xr?.rank??null,points:xr?.points??0,exact:xr?.exact??0},
    month:{value:mo,rank:xm?.rank??null,points:xm?.points??0,exact:xm?.exact??0},
  }});
}

async function prefs(req:Request,b:any){
  const a=await auth(req);
  if(!a.ok)return a.response;
  const p=b.preferences??{},patch:any={};
  if(typeof p.deadline==="boolean")patch.deadline_reminders_enabled=p.deadline;
  if(typeof p.lineup==="boolean")patch.lineup_notifications_enabled=p.lineup;
  if(typeof p.kickoff==="boolean")patch.kickoff_notifications_enabled=p.kickoff;
  if(typeof p.result==="boolean")patch.result_notifications_enabled=p.result;
  if(!Object.keys(patch).length)return out(req,{ok:false,error:"Нет настроек для изменения"},400);
  const q=await db.from("cp_users").update(patch).eq("id",a.user.id)
    .select("deadline_reminders_enabled,lineup_notifications_enabled,kickoff_notifications_enabled,result_notifications_enabled")
    .single();
  if(q.error)throw q.error;
  return out(req,{ok:true,notifications:{
    deadline:q.data.deadline_reminders_enabled!==false,
    lineup:!!q.data.lineup_notifications_enabled,
    kickoff:!!q.data.kickoff_notifications_enabled,
    result:!!q.data.result_notifications_enabled,
  }});
}

const evt=new Set(["boot_error","api_error","nav_guard","stale_cache","render_timing"]);
async function telemetry(req:Request,b:any){
  const a=await auth(req);
  if(!a.ok)return a.response;
  const type=String(b.event_type??"");
  if(!evt.has(type))return out(req,{ok:false,error:"Некорректный тип события"},400);
  const meta:any={};
  for(const k of ["endpoint","status","reason","cache","view","phase"]){
    if(b.meta?.[k]!=null)meta[k]=String(b.meta[k]).slice(0,120);
  }
  const q=await db.from("cp_client_events").insert({
    user_id:a.user.id,
    event_type:type,
    screen:String(b.screen??"").slice(0,64)||null,
    build:String(b.build??"").slice(0,64)||null,
    duration_ms:b.duration_ms==null?null:Math.max(0,Math.min(120000,Number(b.duration_ms)||0)),
    meta,
  });
  if(q.error)throw q.error;
  return out(req,{ok:true});
}

Deno.serve(async req=>{
  try{
    const u=new URL(req.url);
    if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});
    if(req.method==="GET"&&u.searchParams.get("asset")==="emoji"){
      return await fetch(OLD+u.search,{headers:{"x-telegram-init-data":req.headers.get("x-telegram-init-data")??""}});
    }
    if(req.method==="GET")return out(req,{
      ok:true,
      service:"Ciao Core API Fast v4",
      version:5,
      deadline_minutes:15,
      advanced_standings:true,
      unified_competitions:true,
      notifications:true,
      telemetry:true,
      cors_origins:[...ALLOWED_ORIGINS],
    });
    if(req.method!=="POST")return new Response("Method Not Allowed",{status:405});
    const b=await req.json().catch(()=>({})),a=String(b.action??"state");
    if(a==="state")return await state(req,b);
    if(a==="set_round_bonus")return out(req,{ok:false,error:"bonus_disabled"},410);
    if(a==="prediction_rules"){
      const x=await auth(req);
      return x.ok?out(req,{ok:true,rules:await rules()}):x.response;
    }
    if(a==="standings_scope")return await scope(req,b);
    if(a==="public_predictor")return await predictor(req,b);
    if(a==="set_notification_preferences")return await prefs(req,b);
    if(a==="client_event")return await telemetry(req,b);
    const x=await old(req,b);
    return out(req,x.j,x.r.status);
  }catch(e){
    console.error("core_v4_error",e);
    return out(req,{ok:false,error:e instanceof Error?e.message:String(e)},500);
  }
});
