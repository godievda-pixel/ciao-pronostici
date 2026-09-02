import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function buildModule() {
  return import('../scripts/build.mjs');
}

test('build copies v23.3 browser modules required by multi-competition UI', async () => {
  const { copyV233Modules } = await buildModule();
  assert.equal(typeof copyV233Modules, 'function');

  const files = await copyV233Modules();
  assert.equal(files.includes('competition-data.mjs'), true);
  assert.equal(files.includes('data-client.mjs'), true);

  const competitionData = await readFile(
    new URL('../dist/v23.3/competition-data.mjs', import.meta.url),
    'utf8',
  );
  const dataClient = await readFile(
    new URL('../dist/v23.3/data-client.mjs', import.meta.url),
    'utf8',
  );

  assert.match(competitionData, /predictionDeadlineForKickoff/);
  assert.match(dataClient, /loadCompetitionStandings/);
  assert.match(dataClient, /loadMatchCenterSnapshot/);
});
