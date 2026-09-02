const STYLE_ID = 'ciao-v233-premium-polish';

const CSS = `
/* Tournament hub: keep the existing app palette, remove redundant technical copy. */
.cw232-tournament-card__eyebrow,.cw232-tournament-card__hint{display:none!important}
.cw232-tournament-card{min-height:92px!important;grid-template-columns:minmax(0,1fr) auto!important;grid-template-areas:"title arrow"!important;align-items:center!important;padding:20px!important;border-radius:22px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 12px 32px rgba(0,0,0,.14)!important}
.cw232-tournament-card>strong{grid-area:title!important;font-size:19px!important;letter-spacing:-.025em!important;line-height:1.05!important}
.cw232-tournament-card__arrow{grid-area:arrow!important;align-self:center!important;font-size:24px!important;opacity:.74!important}

/* Tables: premium compact mobile-first table, no horizontal 650px canvas. */
.cw233-tables-head{margin:0 0 14px!important;padding:18px 18px 17px!important;border:1px solid rgba(255,255,255,.1)!important;border-radius:22px!important;background:linear-gradient(145deg,rgba(37,74,218,.25),rgba(9,18,43,.36))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)!important}
.cw233-tables-head>span{opacity:.48!important}.cw233-tables-head h2{font-size:29px!important}.cw233-tables-head p{margin-top:5px!important}
.cw233-table-selectors-viewport{margin-bottom:12px!important}.cw233-table-selector{min-height:40px!important;border-radius:13px!important;background:rgba(255,255,255,.045)!important}.cw233-table-selector.is-active{background:linear-gradient(180deg,#3150ff,#142bd6)!important;color:#fff!important;border-color:rgba(109,134,255,.58)!important;box-shadow:0 6px 18px rgba(23,48,207,.28)!important}
.cw233-standing-viewport{overflow:visible!important;border:0!important;border-radius:0!important;background:transparent!important}
.cw233-standing-table{width:100%!important;min-width:0!important;border-collapse:separate!important;border-spacing:0 8px!important;table-layout:fixed!important;font-size:12px!important}
.cw233-standing-table thead th{padding:0 8px 4px!important;border:0!important;color:rgba(177,190,226,.58)!important;font-size:9px!important}
.cw233-standing-table th:nth-child(1),.cw233-standing-table td:nth-child(1){width:38px!important}
.cw233-standing-table th:nth-child(3),.cw233-standing-table td:nth-child(3){width:38px!important}
.cw233-standing-table th:nth-child(8),.cw233-standing-table td:nth-child(8){width:46px!important}
.cw233-standing-table tbody td{height:58px!important;padding:9px 7px!important;border-top:1px solid rgba(255,255,255,.075)!important;border-bottom:1px solid rgba(255,255,255,.075)!important;background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.032))!important}
.cw233-standing-table tbody td:first-child{border-left:1px solid rgba(255,255,255,.075)!important;border-radius:16px 0 0 16px!important}
.cw233-standing-table tbody td:last-child{border-right:1px solid rgba(255,255,255,.075)!important;border-radius:0 16px 16px 0!important}
.cw233-standing-position{font-weight:900!important;color:#aebeff!important}.cw233-standing-points{font-size:15px!important;font-weight:950!important;color:#fff!important}
.cw233-standing-team{display:table-cell!important;min-width:0!important;text-align:left!important;vertical-align:middle!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.cw233-standing-team strong{display:inline-block!important;max-width:calc(100% - 43px)!important;vertical-align:middle!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:12px!important}
.cw233-table-logo{display:inline-block!important;width:31px!important;height:31px!important;min-width:31px!important;margin-right:8px!important;vertical-align:middle!important;object-fit:contain!important;filter:drop-shadow(0 3px 8px rgba(0,0,0,.25))!important}
.cw233-table-logo--empty{border-radius:50%!important;background:radial-gradient(circle at 35% 30%,rgba(89,116,255,.34),rgba(255,255,255,.055) 70%)!important;border:1px solid rgba(255,255,255,.06)!important}
.cw233-table-logo-fallback{display:inline-flex!important;align-items:center!important;justify-content:center!important;color:#b9c5ec!important;font-size:10px!important;font-weight:900!important}

/* Ranking: same navy/royal visual language, but purpose-built hierarchy instead of a generic list. */
.cw233-ranking-page{display:grid!important;gap:13px!important;padding:0 0 18px!important}
.cw233-ranking-hero{position:relative!important;overflow:hidden!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:14px!important;align-items:center!important;margin:0!important;padding:18px!important;border:1px solid rgba(105,132,255,.32)!important;border-radius:24px!important;background:radial-gradient(circle at 88% 12%,rgba(58,82,255,.35),transparent 34%),linear-gradient(145deg,rgba(23,64,151,.72),rgba(16,24,93,.88) 70%,rgba(25,35,130,.92))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 16px 38px rgba(0,6,35,.22)!important}
.cw233-ranking-hero:after{content:"";position:absolute;inset:auto -38px -70px auto;width:170px;height:170px;border-radius:50%;background:rgba(55,82,255,.13);filter:blur(4px);pointer-events:none}
.cw233-ranking-identity{position:relative;z-index:1;display:flex;align-items:center;gap:12px;min-width:0}
.cw233-ranking-identity-copy{min-width:0}.cw233-ranking-kicker{display:block;margin-bottom:4px;color:#9eb3ff;font-size:9px;font-weight:900;letter-spacing:.12em}
.cw233-ranking-identity h2{margin:0!important;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff!important;font-size:21px!important;line-height:1.1!important;letter-spacing:-.025em!important}
.cw233-ranking-identity p{margin:5px 0 0!important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(206,216,247,.72)!important;font-size:11px!important}
.cw233-ranking-avatar{display:flex;align-items:center;justify-content:center;width:36px;height:36px;min-width:36px;border:1px solid rgba(126,151,255,.26);border-radius:13px;background:linear-gradient(145deg,rgba(73,104,255,.24),rgba(28,42,105,.62));color:#dce4ff;font-size:11px;font-weight:950;letter-spacing:.03em;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
.cw233-ranking-avatar--hero{width:48px;height:48px;min-width:48px;border-radius:16px;border-color:rgba(143,164,255,.42);background:linear-gradient(145deg,rgba(83,112,255,.55),rgba(26,45,137,.74));font-size:14px;color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 8px 20px rgba(2,12,54,.22)}
.cw233-ranking-hero-stats{position:relative;z-index:1;display:flex;gap:7px}
.cw233-ranking-stat{display:flex;min-width:58px;flex-direction:column;align-items:flex-end;padding:8px 9px;border:1px solid rgba(255,255,255,.08);border-radius:13px;background:rgba(3,10,43,.2)}
.cw233-ranking-stat strong{color:#fff;font-size:17px;line-height:1;font-weight:950}.cw233-ranking-stat span{margin-top:4px;color:rgba(194,207,244,.62);font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
.cw233-ranking-filters-wrap{max-width:100%;overflow:hidden}.cw233-ranking-filters{display:flex!important;width:max-content!important;min-width:100%!important;gap:8px!important;overflow-x:auto!important;scrollbar-width:none!important;padding:0 1px 1px!important}.cw233-ranking-filters::-webkit-scrollbar{display:none}
.cw233-ranking-filters button{min-height:38px!important;flex:none!important;border-radius:12px!important;padding:0 15px!important;font-size:11px!important}.cw233-ranking-filters button[aria-selected="true"]{box-shadow:0 7px 18px rgba(30,58,222,.26)!important}
.cw233-ranking-section{display:grid;gap:9px}.cw233-ranking-section-head{margin:1px 2px 0!important}.cw233-ranking-section-head h3{font-size:14px!important}.cw233-ranking-section-head span{font-size:10px!important;color:rgba(179,194,232,.62)!important}
.cw233-ranking-section>.card{padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;overflow:visible!important}
.cw233-ranking-list{display:grid;gap:8px}
.cw233-ranking-row{display:grid!important;grid-template-columns:36px 36px minmax(0,1fr) auto!important;gap:9px!important;align-items:center!important;min-height:62px!important;padding:10px 11px!important;border:1px solid rgba(255,255,255,.075)!important;border-radius:17px!important;background:linear-gradient(180deg,rgba(255,255,255,.052),rgba(255,255,255,.027))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025)!important}
.cw233-ranking-row.is-me{border-color:rgba(77,111,255,.58)!important;background:radial-gradient(circle at 92% 20%,rgba(53,78,255,.16),transparent 32%),linear-gradient(180deg,rgba(36,62,169,.26),rgba(18,30,94,.24))!important;box-shadow:inset 0 1px 0 rgba(120,145,255,.1),0 8px 24px rgba(13,34,129,.13)!important}
.cw233-ranking-position{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:11px;background:rgba(255,255,255,.038);color:#aebcf0;font-weight:950}.cw233-ranking-position .pos{font-size:11px!important;font-weight:950!important}
.cw233-ranking-position.is-podium-1{background:linear-gradient(145deg,rgba(255,208,79,.24),rgba(114,82,13,.18));color:#ffe29a}.cw233-ranking-position.is-podium-2{background:linear-gradient(145deg,rgba(207,218,241,.2),rgba(87,99,128,.16));color:#e2e9f8}.cw233-ranking-position.is-podium-3{background:linear-gradient(145deg,rgba(205,139,89,.22),rgba(103,61,33,.16));color:#eeb890}
.cw233-ranking-person{min-width:0}.cw233-ranking-person .person{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;color:#fff!important;font-size:12px!important;font-weight:850!important}.cw233-ranking-username{display:block;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(168,184,225,.58);font-size:9px}
.cw233-ranking-points{display:flex;align-items:baseline;justify-content:flex-end;gap:3px;min-width:47px}.cw233-ranking-points .pts{color:#fff!important;font-size:17px!important;line-height:1!important;font-weight:950!important}.cw233-ranking-points span{color:rgba(169,185,225,.55);font-size:8px;font-weight:800}
.cw233-ranking-empty{display:flex;min-height:120px;flex-direction:column;align-items:center;justify-content:center;padding:24px;border:1px solid rgba(255,255,255,.06);border-radius:18px;background:rgba(255,255,255,.025);text-align:center}.cw233-ranking-empty strong{color:#fff;font-size:13px}.cw233-ranking-empty span{margin-top:6px;color:rgba(176,191,229,.58);font-size:10px}
.cw233-ranking-skeleton{display:grid;gap:8px}.cw233-ranking-skeleton-row{height:62px;border:1px solid rgba(255,255,255,.045);border-radius:17px;background:linear-gradient(100deg,rgba(255,255,255,.025) 20%,rgba(255,255,255,.07) 40%,rgba(255,255,255,.025) 60%);background-size:220% 100%;animation:cw233-ranking-pulse 1.3s ease-in-out infinite}
@keyframes cw233-ranking-pulse{0%{background-position:100% 0}100%{background-position:-100% 0}}

@media(max-width:620px){
  #ciao-v233-tables-overlay{padding-left:10px!important;padding-right:10px!important}
  .cw233-tables-head{padding:16px!important}.cw233-tables-head h2{font-size:27px!important}
  .cw233-standing-table th:nth-child(4),.cw233-standing-table td:nth-child(4),
  .cw233-standing-table th:nth-child(5),.cw233-standing-table td:nth-child(5),
  .cw233-standing-table th:nth-child(6),.cw233-standing-table td:nth-child(6),
  .cw233-standing-table th:nth-child(7),.cw233-standing-table td:nth-child(7){display:none!important}
  .cw233-standing-team strong{font-size:12px!important;max-width:calc(100% - 41px)!important}
  .cw233-standing-table tbody td{height:56px!important}
}
@media(max-width:390px){
  .cw233-ranking-hero{grid-template-columns:1fr!important;padding:16px!important}
  .cw233-ranking-hero-stats{justify-content:flex-start}.cw233-ranking-stat{align-items:flex-start}
  .cw233-ranking-row{grid-template-columns:31px 34px minmax(0,1fr) auto!important;gap:7px!important;padding:9px!important}
  .cw233-ranking-position{width:30px;height:30px;border-radius:10px}.cw233-ranking-avatar{width:34px;height:34px;min-width:34px}
}
`;

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || '?';
}

function installStyles(documentRef) {
  if (documentRef.getElementById(STYLE_ID)) return;
  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  documentRef.head?.appendChild(style);
}

function fallbackLogo(img) {
  const cell = img?.closest?.('.cw233-standing-team');
  if (!cell || img.dataset.cw233FallbackApplied === '1') return;
  img.dataset.cw233FallbackApplied = '1';
  const fallback = document.createElement('span');
  fallback.className = 'cw233-table-logo cw233-table-logo--empty cw233-table-logo-fallback';
  fallback.textContent = initials(cell.querySelector('strong')?.textContent);
  img.replaceWith(fallback);
}

function hydrateTableLogos(documentRef) {
  for (const row of documentRef.querySelectorAll?.('[data-cw233-standing-team]') || []) {
    const cell = row.querySelector?.('.cw233-standing-team');
    if (!cell) continue;
    const image = cell.querySelector('img.cw233-table-logo');
    if (image) {
      image.addEventListener('error', () => fallbackLogo(image), { once:true });
      continue;
    }
    const empty = cell.querySelector('.cw233-table-logo--empty');
    const teamId = String(row.dataset?.cw233StandingTeam || '').trim();
    if (!empty || !/^\d+$/.test(teamId)) continue;
    const img = documentRef.createElement('img');
    img.className = 'cw233-table-logo';
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = `https://sports.bzzoiro.com/img/team/${encodeURIComponent(teamId)}/?bg=transparent`;
    img.addEventListener('error', () => fallbackLogo(img), { once:true });
    empty.replaceWith(img);
  }
}

export function installPremiumPolishUi(documentRef = globalThis.document) {
  if (!documentRef) return null;
  installStyles(documentRef);
  const apply = () => hydrateTableLogos(documentRef);
  apply();
  if (typeof MutationObserver !== 'function') return Object.freeze({ disconnect() {} });
  const observer = new MutationObserver(apply);
  observer.observe(documentRef.documentElement || documentRef.body, { childList:true, subtree:true });
  return observer;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => installPremiumPolishUi(document), { once:true });
  else installPremiumPolishUi(document);
}
