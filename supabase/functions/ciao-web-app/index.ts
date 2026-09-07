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
  if(!st.ok)throw new Error(`release_state_http_${st.status}`);
  const arr=await st.json();
  const id=arr?.[0]?.current_build;
  if(!id)throw new Error("release_state_missing");
  const br=await fetch(`${SUPABASE_URL}/rest/v1/cp_frontend_builds?build_id=eq.${encodeURIComponent(id)}&select=build_id,url,is_stable`,{headers:head});
  if(!br.ok)throw new Error(`build_http_${br.status}`);
  const builds=await br.json();
  const b=builds?.[0];
  if(!b?.is_stable||!b?.url)throw new Error("build_disabled");
  cached=b;
  last=Date.now();
  return b;
}

async function resolveBuild(){
  try{return{build:await activeBuild(),resolution_error:null}}
  catch(e){
    const resolution_error=e instanceof Error?e.message:String(e);
    console.error("launcher_resolve_error",resolution_error);
    return{build:null,resolution_error};
  }
}

const NO_STORE_HEADERS={
  "cache-control":"no-store, no-cache, must-revalidate, max-age=0",
  "pragma":"no-cache",
  "expires":"0",
};

Deno.serve(async req=>{
  const u=new URL(req.url);
  if(u.pathname.endsWith("/health")){
    const r=await resolveBuild();
    const b=r.build;
    return Response.json({
      ok:!!b,
      service:"Ciao Web Redirect",
      mode:"redirect",
      version:4,
      current_build:b?.build_id??null,
      url:b?.url??null,
      resolution_error:r.resolution_error,
      supabase_url_present:Boolean(SUPABASE_URL),
      service_key_present:Boolean(serviceKey()),
    },{status:b?200:503,headers:NO_STORE_HEADERS});
  }

  const r=await resolveBuild();
  const resolved=r.build;
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
