import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const apiRoot=new URL('../../supabase/functions/ciao-v23-api/',import.meta.url);

async function source(path){
  return await readFile(new URL(path,apiRoot),'utf8');
}

async function exists(path){
  try{
    await access(new URL(path,apiRoot),constants.F_OK);
    return true;
  }catch{
    return false;
  }
}

test('standalone ciao-v23-api exposes no legacy/modular compatibility routing',async()=>{
  const index=await source('index.ts');
  const router=await source('router.mjs');
  const combined=`${index}\n${router}`;
  assert.doesNotMatch(combined,/legacyState|legacyAction|legacy-surface|modular_(?:action|route|screen)/i);
  assert.doesNotMatch(index,/from ['"]\.\/modular-(?:actions|runtime)\.mjs['"]/);
  assert.doesNotMatch(router,/modular_(?:matches|standings|predictions|ranking|match_center)/i);
});

test('obsolete ciao-v23-api compatibility modules are physically absent',async()=>{
  assert.equal(await exists('modular-actions.mjs'),false,'modular-actions.mjs must be removed');
  assert.equal(await exists('modular-runtime.mjs'),false,'modular-runtime.mjs must be removed');
});
