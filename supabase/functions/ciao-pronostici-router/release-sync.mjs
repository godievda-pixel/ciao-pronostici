import { contentRevision,isReleaseRevision,telegramAppUrl } from './release-revision.mjs';

export async function synchronizeRelease({
  requestedRevision,
  fetchWorkerHtml,
  setMenuButton,
  cryptoImpl=globalThis.crypto,
}){
  if(!isReleaseRevision(requestedRevision)){
    return{status:400,body:{ok:false,error:'invalid_revision'}};
  }

  const html=await fetchWorkerHtml();
  const liveRevision=await contentRevision(html,cryptoImpl);
  if(liveRevision!==requestedRevision){
    return{
      status:409,
      body:{
        ok:false,
        error:'live_revision_mismatch',
        requested_revision:requestedRevision,
        live_revision:liveRevision,
      },
    };
  }

  const url=telegramAppUrl(requestedRevision);
  const telegram=await setMenuButton(url);
  if(!telegram?.ok){
    return{
      status:502,
      body:{
        ok:false,
        error:'telegram_menu_update_failed',
        requested_revision:requestedRevision,
        live_revision:liveRevision,
        telegram_error:telegram?.description??null,
      },
    };
  }

  return{
    status:200,
    body:{
      ok:true,
      requested_revision:requestedRevision,
      live_revision:liveRevision,
      web_app_url:url,
    },
  };
}
