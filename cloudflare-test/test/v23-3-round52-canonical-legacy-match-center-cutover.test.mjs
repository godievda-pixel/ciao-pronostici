import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyHomeV233SourcePatch } from '../scripts/home-v23-3-source-patch.mjs';
import { resolveCanonicalMatchTarget } from '../src/v23.3/match-center-links.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const INTERACTIVE_SELECTOR = 'button,input,select,textarea,a,[data-cw233-pred-nav]';
const PREDICTION_CONTROL_SELECTOR = '[data-cw233-delta],[data-cw233-save-all],[data-cw231-action="predict"]';
const MATCH_CENTER_BUTTON_SELECTOR = '[data-cw231-action="match-center"]';

function node(dataset = {}, closest = () => null) {
  return { dataset, closest };
}

function targetWith(mapping = {}) {
  return {
    closest(selector) {
      return Object.prototype.hasOwnProperty.call(mapping, selector) ? mapping[selector] : null;
    },
  };
}

test('Round 52 canonical router opens the legacy Match Center boundary, never Round51.2', async () => {
  const source = await read('../src/v23.3/match-center-links.mjs');
  assert.match(source, /from '\.\/match-center\.mjs'/);
  assert.doesNotMatch(source, /round51-2-match-center/);
  assert.doesNotMatch(source, /CiaoV2512MatchCenterRuntime/);
});

test('Round 52 resolves canonical cards for all five competitions', () => {
  const cases = [
    ['serie_a', 'serie_a:10'],
    ['coppa_italia', 'coppa_italia:20'],
    ['ucl', 'ucl:30'],
    ['uel', 'uel:40'],
    ['uecl', 'uecl:50'],
  ];

  for (const [competition, matchId] of cases) {
    const card = node({ cw233Competition:competition, cw233Match:matchId });
    const target = targetWith({
      '[data-cw233-match][data-cw233-competition]':card,
    });
    const resolved = resolveCanonicalMatchTarget(target);
    assert.equal(resolved?.competition, competition);
    assert.equal(resolved?.matchId, matchId);
  }
});

test('Round 52 resolves prediction, profile, schedule and explicit Match Center controls', () => {
  const prediction = node({ cw233PredCard:'ucl:71' });
  const predictionTarget = targetWith({ '[data-cw233-pred-card]':prediction });
  assert.deepEqual(
    { competition:resolveCanonicalMatchTarget(predictionTarget)?.competition, matchId:resolveCanonicalMatchTarget(predictionTarget)?.matchId },
    { competition:'ucl', matchId:'ucl:71' },
  );

  const profile = node({ cw232Competition:'uel', cw232ProfileMatch:'uel:72' });
  const profileTarget = targetWith({ '[data-cw232-profile-match][data-cw232-competition]':profile, '[data-cw232-profile-match]':profile });
  assert.deepEqual(
    { competition:resolveCanonicalMatchTarget(profileTarget)?.competition, matchId:resolveCanonicalMatchTarget(profileTarget)?.matchId },
    { competition:'uel', matchId:'uel:72' },
  );

  const competitionHost = node({ cw232Competition:'uecl' });
  const schedule = node({ cw232Match:'uecl:73' }, selector => selector === '[data-cw232-competition]' ? competitionHost : null);
  const scheduleTarget = targetWith({ '[data-cw232-match]':schedule, '#ciao-v232-matches-overlay':node() });
  assert.deepEqual(
    { competition:resolveCanonicalMatchTarget(scheduleTarget)?.competition, matchId:resolveCanonicalMatchTarget(scheduleTarget)?.matchId },
    { competition:'uecl', matchId:'uecl:73' },
  );

  const button = node();
  const canonicalCard = node({ cw233Competition:'coppa_italia', cw233Match:'coppa_italia:74' });
  const explicitTarget = targetWith({
    [INTERACTIVE_SELECTOR]:button,
    [MATCH_CENTER_BUTTON_SELECTOR]:button,
    '[data-cw233-match][data-cw233-competition]':canonicalCard,
  });
  assert.equal(resolveCanonicalMatchTarget(explicitTarget)?.matchId, 'coppa_italia:74');
});

test('Round 52 never hijacks prediction controls', () => {
  for (const selector of ['[data-cw231-action="predict"]', '[data-cw233-delta]', '[data-cw233-save-all]']) {
    const control = node();
    const target = targetWith({
      [PREDICTION_CONTROL_SELECTOR]:control,
      [selector]:control,
      [INTERACTIVE_SELECTOR]:control,
    });
    assert.equal(resolveCanonicalMatchTarget(target), null);
  }
});

test('v23.1 source patch remains the only rendered Match Center shell', () => {
  const fixture = `
const __cw231HomeHtml = () => '';
let predict;
const root = document.body;
const main = document.body;
let matchReturnTab='predict',matchViewId=null,matchCenterTab='overview',matchData=null,matchLoading=false,tab='predict';
function openMatchCenter(){}
function matchCenterHtml(d){ return String(d); }
function matchTabContent(){ return ''; }
function bindMatchCenter(){}
function closeMatchCenter(){}
function patchMatchCenter(){}
async function refreshMatchCenter(){}
function render(){}
predict = __cw231HomeHtml;
`;
  const patched = applyHomeV233SourcePatch(fixture);
  assert.match(patched, /ciao-v233-open-serie-a-match/);
  assert.match(patched, /ciao-v233-open-external-legacy-match/);
  assert.match(patched, /main\.innerHTML = matchCenterHtml\(matchData\)/);
  assert.match(patched, /bindMatchCenter\(\)/);
  assert.doesNotMatch(patched, /round51-2-bottom-drawer/);
});
