const STYLE_ID = 'cw233-legacy-match-center-theme';

export const LEGACY_MATCH_CENTER_THEME_KEYS = Object.freeze({
  coppa_italia:'coppa_italia',
  champions_league:'ucl',
  europa_league:'uel',
  conference_league:'uecl',
});

const CSS = `
[data-cw233-mc-competition] {
  --cw233-mc-bg:#07162e;
  --cw233-mc-surface:rgba(255,255,255,.055);
  --cw233-mc-surface-strong:rgba(255,255,255,.075);
  --cw233-mc-border:rgba(112,157,232,.20);
  --cw233-mc-accent:#0f52ba;
  --cw233-mc-accent-2:#2153f8;
  --cw233-mc-away:#20a765;
  --cw233-mc-glow:rgba(33,83,248,.20);
}
[data-cw233-mc-competition="coppa_italia"] {
  --cw233-mc-bg:#17090f;
  --cw233-mc-surface:rgba(255,255,255,.052);
  --cw233-mc-surface-strong:rgba(255,255,255,.072);
  --cw233-mc-border:rgba(231,7,46,.30);
  --cw233-mc-accent:#e7072e;
  --cw233-mc-accent-2:#ff3154;
  --cw233-mc-away:#16834b;
  --cw233-mc-glow:rgba(231,7,46,.23);
}
[data-cw233-mc-competition="champions_league"] {
  --cw233-mc-bg:#080b29;
  --cw233-mc-surface:rgba(255,255,255,.055);
  --cw233-mc-surface-strong:rgba(255,255,255,.078);
  --cw233-mc-border:rgba(79,95,255,.30);
  --cw233-mc-accent:#3157ff;
  --cw233-mc-accent-2:#7b42ff;
  --cw233-mc-away:#b1b8dc;
  --cw233-mc-glow:rgba(75,62,255,.25);
}
[data-cw233-mc-competition="europa_league"] {
  --cw233-mc-bg:#160d08;
  --cw233-mc-surface:rgba(255,255,255,.052);
  --cw233-mc-surface-strong:rgba(255,255,255,.075);
  --cw233-mc-border:rgba(240,103,34,.30);
  --cw233-mc-accent:#f06722;
  --cw233-mc-accent-2:#ff9b32;
  --cw233-mc-away:#c5cad5;
  --cw233-mc-glow:rgba(240,103,34,.24);
}
[data-cw233-mc-competition="conference_league"] {
  --cw233-mc-bg:#06170f;
  --cw233-mc-surface:rgba(255,255,255,.052);
  --cw233-mc-surface-strong:rgba(255,255,255,.075);
  --cw233-mc-border:rgba(34,168,102,.30);
  --cw233-mc-accent:#22a866;
  --cw233-mc-accent-2:#55d68e;
  --cw233-mc-away:#d6dde0;
  --cw233-mc-glow:rgba(34,168,102,.23);
}

[data-cw233-mc-competition] .mc-shell {
  background:
    radial-gradient(105% 48% at 50% -12%, var(--cw233-mc-glow), transparent 68%),
    var(--cw233-mc-bg);
}
[data-cw233-mc-competition] .mc-toolbar,
[data-cw233-mc-competition] .mc-tabs-wrap {
  background:color-mix(in srgb, var(--cw233-mc-bg) 88%, transparent);
  border-color:var(--cw233-mc-border);
}
[data-cw233-mc-competition] .mc-back {
  border-color:var(--cw233-mc-border);
  background:var(--cw233-mc-surface);
}
[data-cw233-mc-competition] .mc-back:active {
  background:var(--cw233-mc-surface-strong);
}
[data-cw233-mc-competition] .mc-hero {
  border-color:var(--cw233-mc-border);
  background:
    radial-gradient(75% 100% at 50% 0%, var(--cw233-mc-glow), transparent 70%),
    linear-gradient(145deg, var(--cw233-mc-surface-strong), var(--cw233-mc-surface));
}
[data-cw233-mc-competition] .mc-status {
  border-color:var(--cw233-mc-border);
  background:var(--cw233-mc-surface);
}
[data-cw233-mc-competition] .mc-tabs {
  border-color:var(--cw233-mc-border);
  background:var(--cw233-mc-surface);
}
[data-cw233-mc-competition] .mc-tab.active {
  color:#fff;
  border-color:color-mix(in srgb, var(--cw233-mc-accent) 70%, white 8%);
  background:linear-gradient(135deg,var(--cw233-mc-accent),var(--cw233-mc-accent-2));
  box-shadow:0 8px 24px color-mix(in srgb, var(--cw233-mc-accent) 24%, transparent);
}
[data-cw233-mc-competition] .mc-section,
[data-cw233-mc-competition] .mc-key,
[data-cw233-mc-competition] .mc-lineup,
[data-cw233-mc-competition] .mc-rating-row,
[data-cw233-mc-competition] .mc-event {
  border-color:var(--cw233-mc-border);
  background:var(--cw233-mc-surface);
}
[data-cw233-mc-competition] .mc-section-title,
[data-cw233-mc-competition] .mc-key strong,
[data-cw233-mc-competition] .mc-rating {
  color:color-mix(in srgb, var(--cw233-mc-accent-2) 52%, white 48%);
}
[data-cw233-mc-competition] .mc-bar.home i,
[data-cw233-mc-competition] .mc-momentum-bar.home i {
  background:linear-gradient(90deg,var(--cw233-mc-accent),var(--cw233-mc-accent-2));
}
[data-cw233-mc-competition] .mc-bar.away i,
[data-cw233-mc-competition] .mc-momentum-bar.away i {
  background:var(--cw233-mc-away);
}
[data-cw233-mc-competition] .mc-shot.home {
  background:var(--cw233-mc-accent-2);
  border-color:#fff;
}
[data-cw233-mc-competition] .mc-shot.away {
  background:var(--cw233-mc-away);
  border-color:#fff;
}
[data-cw233-mc-competition] .mc-shirt,
[data-cw233-mc-competition] .mc-rating {
  border-color:var(--cw233-mc-border);
  background:color-mix(in srgb, var(--cw233-mc-accent) 16%, var(--cw233-mc-surface));
}
`;

export function installLegacyMatchCenterTheme(documentRef = globalThis.document) {
  if (!documentRef?.head || documentRef.getElementById?.(STYLE_ID)) return false;
  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  documentRef.head.appendChild(style);
  return true;
}

if (typeof globalThis.document !== 'undefined') installLegacyMatchCenterTheme(globalThis.document);
