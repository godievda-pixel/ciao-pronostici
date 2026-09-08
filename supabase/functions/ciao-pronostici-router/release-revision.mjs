export const PRODUCTION_WORKER_URL='https://ciao-web-app.ciao-web.workers.dev/';
export const LAUNCHER_BASE_URL='https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-web-app';

const REVISION_RE=/^[0-9a-f]{12}$/;

export function isReleaseRevision(value){
  return REVISION_RE.test(String(value??''));
}

export async function contentRevision(input,cryptoImpl=globalThis.crypto){
  if(!cryptoImpl?.subtle?.digest)throw new Error('crypto.subtle unavailable');
  const bytes=typeof input==='string'
    ? new TextEncoder().encode(input)
    : input instanceof Uint8Array
      ? input
      : new Uint8Array(input);
  const digest=await cryptoImpl.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('').slice(0,12);
}

export function telegramAppUrl(revision){
  if(!isReleaseRevision(revision))throw new Error('invalid release revision');
  return `${LAUNCHER_BASE_URL}?tg_rev=${revision}`;
}
