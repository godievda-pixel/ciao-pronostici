import test from 'node:test';
import assert from 'node:assert/strict';
import { applyProfileTournamentSourcePatch } from '../scripts/profile-source-patch.mjs';

const source = `
__cw16MatchesHtml=function(d){
 const m=d?.matches||{},all=Array.isArray(m?.all)?m.all:[],rounds=Array.isArray(m?.rounds)?m.rounds:[],fallback=Number(m?.current_round)||Number(all[0]?.round_number)||1,selected=Number(__cw208ClubRound)||fallback;__cw208ClubRound=selected;
 const chips=rounds.map(r=>\`<button>\${Number(r.number)}</button>\`).join('');
 const rows=all.filter(x=>Number(x.round_number)===selected);
 return \`<section class="cw16-club-section"><div class="cw16-club-section-title">Календарь</div><div class="cw208-rounds">\${chips}</div>\${__cw16MatchRows(rows,d.team?.id,'Матч этого тура пока не найден')}</section>\`;
};
const __cw208BaseOpenClubProfile=openClubProfile;
openClubProfile=async function(teamId){__cw208ClubRound=null;return await __cw208BaseOpenClubProfile(teamId)};
`;

test('profile source patch appends tournament section without replacing legacy Serie A calendar', () => {
  const patched = applyProfileTournamentSourcePatch(source);
  assert.match(patched, /cw232-profile-tournament-enrichment/);
  assert.match(patched, /__cw16MatchRows\(rows,d\.team\?\.id/);
  assert.match(patched, /CiaoV232Profile\?\.renderForClub/);
  assert.match(patched, /CiaoV232Profile\?\.ensureClub/);
  assert.match(patched, /__cw208BaseOpenClubProfile\(teamId\)/);
});

test('profile source patch is idempotent', () => {
  const once = applyProfileTournamentSourcePatch(source);
  assert.equal(applyProfileTournamentSourcePatch(once), once);
});
