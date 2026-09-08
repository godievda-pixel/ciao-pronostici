import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as productionBuild from '../scripts/build.mjs';
import { releaseRevision } from '../scripts/release-revision.mjs';

function fixtureV23(){
  return `<!doctype html><html><head><title>Ciao, Web!</title></head><body>
<script>(function(){const x='ciao-prod-multitournament-predictions-20260907';const y='ciao-v23-native-home-20260908';})();</script>
</body></html>`;
}

test('v23 builder writes the tracked source byte-for-byte and derives revision from index bytes',async()=>{
  assert.equal(typeof productionBuild.buildV23,'function');
  assert.equal(typeof productionBuild.validateV23Source,'function');
  const dir=await mkdtemp(join(tmpdir(),'ciao-v23-'));
  try{
    const sourceHtml=fixtureV23();
    const result=await productionBuild.buildV23({sourceHtml,outputDir:dir});
    const index=await readFile(join(dir,'index.html'));
    const release=await readFile(join(dir,'releases','v23.html'));
    const revision=await readFile(join(dir,'release-revision.txt'),'utf8');
    assert.equal(index.toString('utf8'),sourceHtml);
    assert.equal(release.toString('utf8'),sourceHtml);
    assert.equal(revision,`${releaseRevision(index)}\n`);
    assert.equal(result.revision,releaseRevision(index));
    assert.equal(result.release,'dist/releases/v23.html');
  }finally{
    await rm(dir,{recursive:true,force:true});
  }
});

test('active production build delegates only to the direct v23 builder',()=>{
  const source=productionBuild.build.toString();
  assert.match(source,/buildV23/);
  assert.doesNotMatch(source,/fetch\s*\(/);
  assert.doesNotMatch(source,/injectBsdCrestPatch|injectMultitournamentPatch|injectPredictionMineStagePolishPatch|injectHomeCalcioPolishSafePatch/);
});
