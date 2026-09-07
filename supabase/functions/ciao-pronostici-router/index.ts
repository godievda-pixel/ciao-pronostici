// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const TOKEN=Deno.env.get("TELEGRAM_BOT_TOKEN")??"";
const SB_URL=Deno.env.get("SUPABASE_URL")??"";
const TG=`https://api.telegram.org/bot${TOKEN}`;
const WEBHOOK_SECRET=Deno.env.get("TELEGRAM_WEBHOOK_SECRET")??`cp_${(TOKEN.split(":").pop()??"missing").slice(-40)}`;
const APP_URL="https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-web-app";
const TELEGRAM_APP_URL=APP_URL;
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

const miniKb=(admin=false)=>({
  inline_keyboard:[
    [{text:"⚽ Открыть Ciao, Web!",web_app:{url:TELEGRAM_APP_URL}}],
    ...(admin?[[{text:"🧪 Ciao TEST",web_app:{url:APP_TEST_URL}}]]:[]),
  ],
});
const adminKb=()=>({inline_keyboard:[[{text:"🛠 Открыть Ciao Admin",web_app:{url:ADMIN_URL}}]]});

async function ensureMenu(force=false){
  if(!force&&Date.now()-menuUpdatedAt<10*60*1000)return{ok:true,cached:true};
  const r=await tg("setChatMenuButton",{
    menu_button:{type:"web_app",text:"⚽ Ciao Web",web_app:{url:TELEGRAM_APP_URL}},
  });
  if(r.ok)menuUpdatedAt=Date.now();
  return r;
}

const send=(chat,text,reply_markup=miniKb(false))=>tg("sendMessage",{chat_id:chat,text,parse_mode:"HTML",reply_markup});
const ack=(c,text="Открой Ciao, Web!")=>tg("answerCallbackQuery",{callback_query_id:c.id,text,show_alert:false});

async function isAdmin(telegramId){
  if(!telegramId)return false;
  const q=await db.from("cp_users").select("is_admin,is_active").eq("telegram_id",Number(telegramId)).maybeSingle();
  return !q.error&&q.data?.is_active===true&&q.data?.is_admin===true;
}

async function appOnly(chat,telegramId){
  await ensureMenu();
  const admin=await isAdmin(telegramId);
  return send(chat,"🇮🇹 <b>Ciao, Web!</b>\n\nЛига Прогнозов, матчи, live-статистика, таблица лучших прогнозистов.\nВсё о мире кальчо!",miniKb(admin));
}

async function adminOnly(chat,telegramId){
  if(!(await isAdmin(telegramId)))return send(chat,"Раздел недоступен.",miniKb(false));
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
  const [menuCheck,info]=await Promise.all([tg("getChatMenuButton",{}),tg("getWebhookInfo")]);
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
    app_url:TELEGRAM_APP_URL,
    launcher_url:APP_URL,
    test_url:APP_TEST_URL,
    admin_url:ADMIN_URL,
  };
}

Deno.serve(async req=>{
  const url=new URL(req.url);
  if(req.method==="GET"){
    return Response.json(url.pathname.endsWith("/setup")?await setup():{
      ok:true,
      service:"Ciao Web Router",
      version:59,
      mode:"launcher_cache_busted_production_plus_permanent_test",
      app_url:TELEGRAM_APP_URL,
      launcher_url:APP_URL,
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
