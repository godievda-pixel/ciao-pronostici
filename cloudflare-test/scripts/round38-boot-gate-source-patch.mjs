export const ROUND38_BOOT_GATE_MARKER = 'ciao-v233-boot-gate-inline-style';

const INLINE_STYLE = `<style id="${ROUND38_BOOT_GATE_MARKER}">
#ciao-v233-boot-gate{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 78% -8%,rgba(49,92,255,.24),transparent 34%),linear-gradient(180deg,#061128 0%,#040b1b 100%);color:#fff;font-family:inherit;transition:opacity .18s ease,visibility .18s ease}
#ciao-v233-boot-gate[data-released="1"]{opacity:0;visibility:hidden;pointer-events:none}
#ciao-v233-boot-gate .cw238-boot-mark{display:grid;justify-items:center;gap:10px;padding:20px;text-align:center}
#ciao-v233-boot-gate .cw238-boot-logo{font-size:26px;font-weight:950;letter-spacing:-.045em;text-shadow:0 8px 28px rgba(35,77,255,.28)}
#ciao-v233-boot-gate .cw238-boot-line{width:86px;height:3px;overflow:hidden;border-radius:99px;background:rgba(118,145,255,.14)}
#ciao-v233-boot-gate .cw238-boot-line:after{content:"";display:block;width:44%;height:100%;border-radius:inherit;background:linear-gradient(90deg,#315CFF,#6d86ff);box-shadow:0 0 18px rgba(49,92,255,.55);animation:cw238Boot 1s ease-in-out infinite alternate}
@keyframes cw238Boot{from{transform:translateX(-10%)}to{transform:translateX(138%)}}
</style>`;

const INLINE_GATE = `<div id="ciao-v233-boot-gate" role="status" aria-live="polite" aria-label="Загрузка Ciao, Web!">
  <div class="cw238-boot-mark"><div class="cw238-boot-logo">Ciao, Web!</div><div class="cw238-boot-line" aria-hidden="true"></div></div>
</div>`;

export function applyRound38BootGateSourcePatch(input) {
  let html = String(input ?? '');
  if (!html || html.includes(`id="${ROUND38_BOOT_GATE_MARKER}"`)) return html;
  if (!/<\/head>/i.test(html) || !/<body\b[^>]*>/i.test(html)) {
    throw new Error('round38 boot gate requires head/body anchors');
  }
  html = html.replace(/<\/head>/i, `${INLINE_STYLE}\n</head>`);
  html = html.replace(/<body\b[^>]*>/i, match => `${match}\n${INLINE_GATE}`);
  return html;
}
