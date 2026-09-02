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
