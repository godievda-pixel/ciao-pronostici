export function applyProfileTournamentSourcePatch(input) {
  let source = String(input);
  if (source.includes('cw232-profile-tournament-enrichment')) return source;

  const rendererStart = source.indexOf('__cw16MatchesHtml=function(d){');
  const rendererEnd = source.indexOf('const __cw208BaseOpenClubProfile=openClubProfile;', rendererStart);
  if (rendererStart < 0 || rendererEnd < 0) return source;

  let renderer = source.slice(rendererStart, rendererEnd);
  const returnPattern = /return (`<section class="cw16-club-section">[\s\S]*?<\/section>`);\s*\};/;
  if (!returnPattern.test(renderer)) return source;

  renderer = renderer.replace(
    returnPattern,
    "const __cw232Legacy=$1;const __cw232Extra=globalThis.CiaoV232Profile?.renderForClub?.(d?.team)||'';return __cw232Legacy+__cw232Extra;};",
  );
  source = source.slice(0, rendererStart) + renderer + source.slice(rendererEnd);

  const openPattern = /const __cw208BaseOpenClubProfile=openClubProfile;\s*openClubProfile=async function\(teamId\)\{__cw208ClubRound=null;return await __cw208BaseOpenClubProfile\(teamId\)\};/;
  if (!openPattern.test(source)) return source;

  source = source.replace(
    openPattern,
    `const __cw208BaseOpenClubProfile=openClubProfile;
openClubProfile=async function(teamId){
  /* cw232-profile-tournament-enrichment */
  __cw208ClubRound=null;
  const __cw232Result=await __cw208BaseOpenClubProfile(teamId);
  const __cw232Team=clubViewData?.team||{id:Number(teamId)};
  globalThis.CiaoV232Profile?.ensureClub?.(__cw232Team).then(()=>{
    if(Number(clubViewId)===Number(teamId))render();
  }).catch(()=>{});
  return __cw232Result;
};`,
  );

  return source;
}
