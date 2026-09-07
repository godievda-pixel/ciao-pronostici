// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")??"";

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

let cached=null,last=0;

async function activeBuild(){
  if(cached&&Date.now()-last<30000)return cached;
  const key=serviceKey();
  if(!SUPABASE_URL||!key)throw new Error("launcher_env_missing");
  const head={"apikey":key,"authorization":`Bearer ${key}`};
  const st=await fetch(`${SUPABASE_URL}/rest/v1/cp_frontend_release_state?id=eq.1&select=current_build`,{headers:head});
  const arr=await st.json();
  const id=arr?.[0]?.current_build;
  if(!id)throw new Error("release_state_missing");
  const br=await fetch(`${SUPABASE_URL}/rest/v1/cp_frontend_builds?build_id=eq.${encodeURIComponent(id)}&select=build_id,url,enabled`,{headers:head});
  const builds=await br.json();
  const b=builds?.[0];
  if(!b?.enabled||!b?.url)throw new Error("build_disabled");
  cached=b;
  last=Date.now();
  return b;
}

async function safeBuild(){
  try{return await activeBuild()}
  catch(e){console.error("launcher_resolve_error",e);return null}
}

const NO_STORE_HEADERS={
  "cache-control":"no-store, no-cache, must-revalidate, max-age=0",
  "pragma":"no-cache",
  "expires":"0",
};

Deno.serve(async req=>{
  const u=new URL(req.url);
  if(u.pathname.endsWith("/health")){
    const b=await safeBuild();
    return Response.json({
      ok:!!b,
      service:"Ciao Web Redirect",
      mode:"redirect",
      version:2,
      current_build:b?.build_id??null,
      url:b?.url??null,
    },{status:b?200:503,headers:NO_STORE_HEADERS});
  }

  const resolved=await safeBuild();
  if(!resolved){
    return new Response("Ciao, Web! launcher unavailable",{
      status:503,
      headers:{"content-type":"text/plain; charset=utf-8",...NO_STORE_HEADERS},
    });
  }

  const target=new URL(resolved.url);
  target.searchParams.set("v",String(Date.now()));
  return new Response(null,{
    status:302,
    headers:{location:target.toString(),...NO_STORE_HEADERS},
  });
});
