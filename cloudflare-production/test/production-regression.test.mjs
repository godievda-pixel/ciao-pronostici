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
      else if(entry.isFile()&&/\.(mjs|css|html)$/.test(entry.name))out.push(await readFile(next,'utf8'));
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

test('standalone v23 sources contain no legacy adapter or TEST runtime hostname',async()=>{
  const source=await sourceTree('src/v23');
  assert.doesNotMatch(source,/legacy-surface-adapter|data-ciao-modular|\/modular\//i);
  assert.doesNotMatch(source,/ciao-web-v23-test|lcnwccnkkxaosxnfvjvr|dkefzepiiudehhzbbrjn/);
});

test('build owns only the standalone v23 source and environment meta contract',async()=>{
  const build=await text('scripts/build.mjs');
  assert.match(build,/src\/v23/);
  assert.match(build,/ciao-api-url/);
  assert.doesNotMatch(build,/RELEASE_SOURCE_URL|injectModularAssets|legacy-surface-adapter/);
  assert.doesNotMatch(build,/v22-5-resolved-no-x2\.html/);
});
