import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULAR_MARKER, NO_X2_MARKER } from './build.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const defaultDist=resolve(root,'dist');
const REQUIRED_FILES=Object.freeze([
  'index.html',
  'releases/v22-5.html',
  'modular/app.mjs',
  'modular/app.css',
  'modular/core/router.mjs',
  'modular/core/route-renderer.mjs',
  'modular/core/legacy-surface-adapter.mjs',
  'modular/data/api-client.mjs',
  'modular/data/data-service.mjs',
  'modular/screens/match-center.mjs',
  'modular/screens/matches.mjs',
  'modular/screens/predictions.mjs',
  'modular/screens/ranking.mjs',
  'modular/screens/tables.mjs',
]);
const FORBIDDEN_RUNTIME=/cloudflare-test|ciao-web-test|Round\d+|ROUND\d+|TEST_HOST|TEST_RUNTIME/;

async function exists(path){
  try{return (await stat(path)).isFile()}catch{return false}
}

async function modularFiles(distDir){
  const base=resolve(distDir,'modular');
  const files=[];
  async function walk(path){
    for(const entry of await readdir(path,{withFileTypes:true})){
      const next=resolve(path,entry.name);
      if(entry.isDirectory())await walk(next);
      else if(entry.isFile())files.push(next);
    }
  }
  try{await walk(base)}catch{return []}
  return files;
}

export async function probeProductionBuild({distDir=defaultDist}={}){
  const dist=resolve(String(distDir));
  const checks=[];
  const errors=[];
  const check=(name,ok,detail='')=>{
    checks.push({name,ok:Boolean(ok),detail:String(detail||'')});
    if(!ok)errors.push(detail?`${name}: ${detail}`:name);
  };

  const missing=[];
  for(const file of REQUIRED_FILES)if(!(await exists(resolve(dist,file))))missing.push(file);
  check('required_files',missing.length===0,missing.join(', '));

  const index=await readFile(resolve(dist,'index.html'),'utf8').catch(()=> '');
  check('stable_no_x2_marker',index.includes(NO_X2_MARKER),NO_X2_MARKER);
  const markerCount=(index.match(new RegExp(`data-ciao-modular=["']${MODULAR_MARKER}["']`,'g'))||[]).length;
  check('single_modular_asset_pair',markerCount===2,`markers=${markerCount}`);
  check('module_entry',/<script\b[^>]*type=["']module["'][^>]*src=["']\/modular\/app\.mjs["']/.test(index),'module app.mjs');

  const files=await modularFiles(dist);
  let forbidden='';
  let hasBuildMarker=false;
  let hasSerieAContext=false;
  for(const file of files){
    if(!/\.(mjs|css)$/.test(file))continue;
    const source=await readFile(file,'utf8');
    if(!forbidden&&FORBIDDEN_RUNTIME.test(source))forbidden=relative(dist,file);
    if(source.includes('main-modular-v1'))hasBuildMarker=true;
    if(source.includes('Контекст Серии А'))hasSerieAContext=true;
  }
  check('clean_modular_runtime',!forbidden,forbidden);
  check('modular_build_marker',hasBuildMarker,'main-modular-v1');
  check('removed_serie_a_context',!hasSerieAContext,'Контекст Серии А');

  return Object.freeze({
    ok:errors.length===0,
    dist,
    fileCount:files.length,
    checks:Object.freeze(checks),
    errors:Object.freeze(errors),
  });
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  probeProductionBuild().then(result=>{
    console.log(JSON.stringify(result,null,2));
    if(!result.ok)process.exitCode=1;
  }).catch(error=>{
    console.error(error instanceof Error?error.message:String(error));
    process.exitCode=1;
  });
}
