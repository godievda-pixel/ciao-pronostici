import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseRevision, isReleaseRevision } from './release-revision.mjs';

export const WORKER_URL='https://ciao-web-app.ciao-web.workers.dev/';
export const ROUTER_SYNC_URL='https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-pronostici-router/release-sync';
export const TELEGRAM_PROBE_URL='https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-telegram-entry-probe';
export const LAUNCHER_BASE_URL='https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-web-app';
export const REQUIRED_MARKERS=[
  'try{__cwHomePolishDom();__cwHomeBindPolish()}catch(_e){}',
  'Кальчо сегодня',
  'cw-home-profile-premium',
  'disabled aria-disabled="true" tabindex="-1"',
];

const defaultSleep=ms=>new Promise(resolveSleep=>setTimeout(resolveSleep,ms));

async function fetchText(fetchImpl,url,options={}){
  const response=await fetchImpl(url,{
    ...options,
    headers:{'cache-control':'no-cache',...(options.headers||{})},
  });
  if(!response.ok)throw new Error(`HTTP ${response.status} for ${url}`);
  return{response,text:await response.text()};
}

export async function runReleaseGate({
  expectedRevision,
  fetchImpl=fetch,
  sleep=defaultSleep,
  workerAttempts=30,
  telegramAttempts=24,
}={}){
  const fromFile=expectedRevision===undefined
    ?await readFile(new URL('../dist/release-revision.txt',import.meta.url),'utf8')
    :expectedRevision;
  const revision=String(fromFile).trim();
  if(!isReleaseRevision(revision))throw new Error(`invalid expected revision: ${revision}`);

  let workerMatched=false;
  for(let attempt=1;attempt<=workerAttempts;attempt+=1){
    const url=`${WORKER_URL}?release_probe=${revision}-${Date.now()}`;
    const{text}=await fetchText(fetchImpl,url);
    if(releaseRevision(text)===revision){
      workerMatched=true;
      break;
    }
    if(attempt<workerAttempts)await sleep(10_000);
  }
  if(!workerMatched)throw new Error(`Worker revision did not reach ${revision}`);

  const sync=await fetchImpl(`${ROUTER_SYNC_URL}?revision=${revision}`,{
    headers:{'cache-control':'no-cache'},
  });
  const syncBody=await sync.json();
  if(!sync.ok||syncBody?.ok!==true||syncBody?.live_revision!==revision){
    throw new Error(`Telegram release sync failed for ${revision}`);
  }

  const expectedMenuUrl=`${LAUNCHER_BASE_URL}?tg_rev=${revision}`;
  if(syncBody?.web_app_url!==expectedMenuUrl){
    throw new Error(`Telegram release sync returned unexpected URL for ${revision}`);
  }

  let menuMatched=false;
  for(let attempt=1;attempt<=telegramAttempts;attempt+=1){
    const probe=await fetchImpl(TELEGRAM_PROBE_URL,{headers:{'cache-control':'no-cache'}});
    if(!probe.ok)throw new Error(`Telegram probe HTTP ${probe.status}`);
    const body=await probe.json();
    if(body?.menu_button?.web_app_url===expectedMenuUrl){
      menuMatched=true;
      break;
    }
    if(attempt<telegramAttempts)await sleep(5_000);
  }
  if(!menuMatched)throw new Error(`Telegram menu did not reach ${expectedMenuUrl}`);

  const finalResponse=await fetchImpl(expectedMenuUrl,{
    redirect:'follow',
    headers:{'cache-control':'no-cache'},
  });
  if(!finalResponse.ok)throw new Error(`Telegram launcher HTTP ${finalResponse.status}`);
  if(!String(finalResponse.url).startsWith(WORKER_URL)){
    throw new Error(`Telegram launcher ended at unexpected URL: ${finalResponse.url}`);
  }
  const finalHtml=await finalResponse.text();
  if(releaseRevision(finalHtml)!==revision)throw new Error('Telegram final HTML revision mismatch');
  for(const marker of REQUIRED_MARKERS){
    if(!finalHtml.includes(marker))throw new Error(`Telegram final HTML missing marker: ${marker}`);
  }

  return{revision};
}

const selfPath=fileURLToPath(import.meta.url);
if(process.argv[1]&&resolve(process.argv[1])===resolve(selfPath)){
  runReleaseGate().then(result=>console.log(JSON.stringify({ok:true,...result}))).catch(error=>{
    console.error(error instanceof Error?error.message:String(error));
    process.exitCode=1;
  });
}
