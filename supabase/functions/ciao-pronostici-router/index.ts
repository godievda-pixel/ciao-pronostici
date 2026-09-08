// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import {
  PRODUCTION_WORKER_URL,
  LAUNCHER_BASE_URL,
  contentRevision,
  telegramAppUrl,
} from "./release-revision.mjs";
import { synchronizeRelease } from "./release-sync.mjs";

const TOKEN=Deno.env.get("TELEGRAM_BOT_TOKEN")??"";
const SB_URL=Deno.env.get("SUPABASE_URL")??"";
const TG=`https://api.telegram.org/bot${TOKEN}`;
const WEBHOOK_SECRET=Deno.env.get("TELEGRAM_WEBHOOK_SECRET")??`cp_${(TOKEN.split(":").pop()??"missing").slice(-40)}`;
const INITIAL_RELEASE_REVISION="e833e3ab9551";
const APP_TEST_URL="https://ciao-web-app-test.ciao-web.workers.dev/";
const ADMIN_URL="https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-admin-web-v20";

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
let menuUpdatedAt=0;
let liveRevisionCache={revision:INITIAL_RELEASE_REVISION,at:0};

async function tg(method,body={}){
  try{
    const r=await fetch(`${TG}/${method}`,{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify(body),
    });
    const j=await r.json();
    if(!j.ok)console.error("tg",method,j.description);
    return j;
  }catch(e){
    return{ok:false,description:String(e)};
  }
}

async function fetchWorkerHtml(){
  const url=new URL(PRODUCTION_WORKER_URL);
  url.searchParams.set("release_probe",String(Date.now()));
  const response=await fetch(url,{headers:{"cache-control":"no-cache"}});
  if(!response.ok)throw new Error(`worker_http_${response.status}`);
  return await response.text();
}

async function currentLiveRevision(force=false){
  if(!force&&liveRevisionCache.revision&&Date.now()-liveRevisionCache.at<30000){
    return liveRevisionCache.revision;
  }
  const html=await fetchWorkerHtml();
  const revision=await contentRevision(html);
  liveRevisionCache={revision,at:Date.now()};
  return revision;
}

async function currentTelegramAppUrl(){
  try{return telegramAppUrl(await currentLiveRevision(false));}
  catch{return telegramAppUrl(liveRevisionCache.revision||INITIAL_RELEASE_REVISION);}
}

const miniKb=(appUrl,admin=false)=>({
  inline_keyboard:[
    [{text:"⚽ Открыть Ciao, Web!",web_app:{url:appUrl}}],
    ...(admin?[[{text:"🧪 Ciao TEST",web_app:{url:APP_TEST_URL}}]]:[]),
  ],
});
const adminKb=()=>({inline_keyboard:[[{text:"🛠 Открыть Ciao Admin",web_app:{url:ADMIN_URL}}]]});

async function ensureMenu(force=false){
  if(!force&&Date.now()-menuUpdatedAt<10*60*1000)return{ok:true,cached:true};
  const appUrl=await currentTelegramAppUrl();
  const r=await tg("setChatMenuButton",{
    menu_button:{type:"web_app",text:"⚽ Ciao Web",web_app:{url:appUrl}},
  });
  if(r.ok)menuUpdatedAt=Date.now();
  return r;
}

const send=(chat,text,reply_markup)=>tg("sendMessage",{chat_id:chat,text,parse_mode:"HTML",reply_markup});
const ack=(c,text="Открой Ciao, Web!")=>tg("answerCallbackQuery",{callback_query_id:c.id,text,show_alert:false});

async function isAdmin(telegramId){
  if(!telegramId)return false;
  const q=await db.from("cp_users").select("is_admin,is_active").eq("telegram_id",Number(telegramId)).maybeSingle();
  return !q.error&&q.data?.is_active===true&&q.data?.is_admin===true;
}

async function appOnly(chat,telegramId){
  await ensureMenu();
  const appUrl=await currentTelegramAppUrl();
  const admin=await isAdmin(telegramId);
  return send(chat,"🇮🇹 <b>Ciao, Web!</b>\n\nЛига Прогнозов, матчи, live-статистика, таблица лучших прогнозистов.\nВсё о мире кальчо!",miniKb(appUrl,admin));
}

async function adminOnly(chat,telegramId){
  if(!(await isAdmin(telegramId))){
    const appUrl=await currentTelegramAppUrl();
    return send(chat,"Раздел недоступен.",miniKb(appUrl,false));
  }
  return send(chat,"🛠 <b>Ciao, Web! Admin</b>\n\nЗакрытая панель управления.",adminKb());
}

async function setup(){
  const me=await tg("getMe");
  if(!me.ok)return{ok:false,critical_ok:false,error:me.description};
  const hook=`${SB_URL}/functions/v1/ciao-pronostici-router`;
  const [wh,menu,name,description,shortDescription,commands]=await Promise.all([
    tg("setWebhook",{url:hook,secret_token:WEBHOOK_SECRET,allowed_updates:["message","callback_query"]}),
    ensureMenu(true),
    tg("setMyName",{name:"Ciao, Web!"}),
    tg("setMyDescription",{description:"🇮🇹 Лига Прогнозов, матчи, live-статистика, таблица лучших прогнозистов. Всё о мире кальчо!"}),
    tg("setMyShortDescription",{short_description:"Лига Прогнозов · матчи · live · Серия А"}),
    tg("setMyCommands",{commands:[{command:"start",description:"Открыть Ciao, Web!"}]}),
  ]);
  const [menuCheck,info,appUrl]=await Promise.all([
    tg("getChatMenuButton",{}),
    tg("getWebhookInfo"),
    currentTelegramAppUrl(),
  ]);
  const criticalOk=!!(wh.ok&&info.ok&&menu.ok&&commands.ok);
  const brandingOk=!!(name.ok&&description.ok&&shortDescription.ok);
  const components={
    webhook:{ok:!!wh.ok,error:wh.ok?null:wh.description??null},
    menu:{ok:!!menu.ok,error:menu.ok?null:menu.description??null},
    commands:{ok:!!commands.ok,error:commands.ok?null:commands.description??null},
    name:{ok:!!name.ok,error:name.ok?null:name.description??null},
    description:{ok:!!description.ok,error:description.ok?null:description.description??null},
    short_description:{ok:!!shortDescription.ok,error:shortDescription.ok?null:shortDescription.description??null},
  };
  return{
    ok:criticalOk,
    critical_ok:criticalOk,
    branding_ok:brandingOk,
    components,
    bot_username:me.result?.username??null,
    webhook_url:info.result?.url??null,
    pending_updates:info.result?.pending_update_count??0,
    last_error:info.result?.last_error_message??null,
    menu_url:menuCheck?.result?.web_app?.url??null,
    app_url:appUrl,
    launcher_url:LAUNCHER_BASE_URL,
    test_url:APP_TEST_URL,
    admin_url:ADMIN_URL,
  };
}

Deno.serve(async req=>{
  const url=new URL(req.url);

  if(req.method==="GET"&&url.pathname.endsWith("/release-sync")){
    const requestedRevision=String(url.searchParams.get("revision")??"");
    try{
      const result=await synchronizeRelease({
        requestedRevision,
        fetchWorkerHtml:()=>fetchWorkerHtml(),
        setMenuButton:(appUrl)=>tg("setChatMenuButton",{
          menu_button:{type:"web_app",text:"⚽ Ciao Web",web_app:{url:appUrl}},
        }),
      });
      if(result.status===200){
        liveRevisionCache={revision:requestedRevision,at:Date.now()};
        menuUpdatedAt=Date.now();
      }
      return Response.json(result.body,{status:result.status});
    }catch(e){
      console.error("release_sync_error",e);
      return Response.json({ok:false,error:"release_sync_failed"},{status:502});
    }
  }

  if(req.method==="GET"){
    if(url.pathname.endsWith("/setup"))return Response.json(await setup());
    const appUrl=await currentTelegramAppUrl();
    return Response.json({
      ok:true,
      service:"Ciao Web Router",
      version:61,
      mode:"content_derived_release_revision",
      app_url:appUrl,
      launcher_url:LAUNCHER_BASE_URL,
      test_url:APP_TEST_URL,
      admin_url:ADMIN_URL,
      admin_command:true,
    });
  }
  if(req.method!=="POST")return new Response("Method Not Allowed",{status:405});
  if(req.headers.get("x-telegram-bot-api-secret-token")!==WEBHOOK_SECRET){
    return Response.json({ok:false,error:"unauthorized"},{status:401});
  }
  try{
    const update=await req.json();
    if(update.message?.chat?.id){
      const text=String(update.message.text??"");
      if(/^\/admin(?:@\w+)?(?:\s|$)/i.test(text))await adminOnly(update.message.chat.id,update.message.from?.id);
      else await appOnly(update.message.chat.id,update.message.from?.id);
    }
    if(update.callback_query){
      await ack(update.callback_query);
      if(update.callback_query?.message?.chat?.id)await appOnly(update.callback_query.message.chat.id,update.callback_query.from?.id);
    }
    return Response.json({ok:true});
  }catch(e){
    console.error("router_error",e);
    return Response.json({ok:true});
  }
});
