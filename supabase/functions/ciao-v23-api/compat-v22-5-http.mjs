import { legacySlugFromUrl } from './compat-v22-5.mjs';

export async function dispatchLegacyHttp({url,body={},context={},dispatcher}={}){
  if(!dispatcher?.dispatch)throw new Error('compat_dispatcher_required');
  const slug=legacySlugFromUrl(url);
  if(!slug)return {handled:false,data:null};
  const data=await dispatcher.dispatch(slug,body,context);
  return {handled:true,data};
}

export function legacyErrorPayload(error){
  const code=String(error?.message||'api_error');
  const payload={ok:false,error:code};
  if(code==='subscription_required')payload.subscription_required=true;
  const extra=error?.extra;
  if(extra&&typeof extra==='object'){
    for(const [key,value] of Object.entries(extra)){
      if(value!==undefined)payload[key]=value;
    }
  }
  return payload;
}
