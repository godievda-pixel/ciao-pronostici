import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');

async function text(path){
  return readFile(resolve(root,path),'utf8').catch(()=> '');
}

async function sourceTree(dir){
  const base=resolve(root,dir);
  const out=[];
  async function walk(path){
    for(const entry of await readdir(path,{withFileTypes:true})){
      const next=resolve(path,entry.name);
      if(entry.isDirectory())await walk(next);
      else if(entry.isFile()&&/\.(mjs|css)$/.test(entry.name))out.push(await readFile(next,'utf8'));
    }
  }
  await walk(base);
  return out.join('\n');
}

test('production readiness includes an executable build probe and package script',async()=>{
  const [probe,pkgText]=await Promise.all([
    text('scripts/probe-production-build.mjs'),
    text('package.json'),
  ]);
  assert.match(probe,/export\s+async\s+function\s+probeProductionBuild/);
  const pkg=JSON.parse(pkgText);
  assert.equal(pkg.scripts['probe:build'],'node scripts/probe-production-build.mjs');
});

test('modular production sources contain no TEST/Round runtime dependency',async()=>{
  const source=await sourceTree('src/modular');
  assert.doesNotMatch(source,/cloudflare-test|ciao-web-test|Round\d+|ROUND\d+|TEST_HOST|TEST_RUNTIME/);
});

test('production shell still preserves stable v22.5/no-x2 and modular ownership markers',async()=>{
  const [build,app,adapter]=await Promise.all([
    text('scripts/build.mjs'),
    text('src/modular/app.mjs'),
    text('src/modular/core/legacy-surface-adapter.mjs'),
  ]);
  assert.match(build,/v22-5-resolved-no-x2\.html/);
  assert.match(build,/ciao-prod-no-x2-20260903/);
  assert.match(app,/main-modular-v1/);
  assert.match(adapter,/LEGACY_ROOT_SELECTOR\s*=\s*'#ciao-miniapp-root'/);
  assert.doesNotMatch(adapter,/profile|settings|rules|admin/i);
});
