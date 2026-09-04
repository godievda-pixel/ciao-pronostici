const ROUND34_MARKER = 'cw233-round34-external-overview-form-only';

const OLD_SANITIZER = `function __cw233Round33SanitizeExternalOverviewHtml(html){
  const holder = document.createElement('div');
  holder.innerHTML = String(html || '');
  for (const marker of holder.querySelectorAll?.('.cw14-form-card') || []) {
    const section = marker.closest?.('.mc-section') || marker.closest?.('section');
    (section || marker).remove?.();
  }
  for (const section of holder.querySelectorAll?.('.mc-section,section') || []) {
    if (/Контекст\\s+Серии\\s*[АA]/i.test(String(section?.textContent || ''))) section.remove?.();
  }
  return holder.innerHTML;
}`;

const NEW_SANITIZER = `/* ${ROUND34_MARKER} */
function __cw233Round33IsFormSection(section){
  if (!section) return false;
  const heading = section.querySelector?.('.mc-section-title,.cw14-form-title,[data-section-title],h2,h3');
  const headingText = String(heading?.textContent || '').replace(/\\s+/g, ' ').trim();
  if (/^Форма(?:\\s|$)/i.test(headingText)) return true;
  const text = String(section.textContent || '').replace(/\\s+/g, ' ').trim();
  return /^Форма(?:\\s|$)/i.test(text);
}
function __cw233Round33SanitizeExternalOverviewHtml(html){
  const holder = document.createElement('div');
  holder.innerHTML = String(html || '');
  for (const marker of holder.querySelectorAll?.('.cw14-form-card') || []) {
    const section = marker.closest?.('.mc-section') || marker.closest?.('section');
    (section || marker).remove?.();
  }
  for (const section of holder.querySelectorAll?.('.mc-section,section') || []) {
    if (__cw233Round33IsFormSection(section)) section.remove?.();
  }
  return holder.innerHTML;
}`;

export function applyRound34ExternalOverviewFormOnlySourcePatch(input) {
  let source = String(input);
  if (source.includes(ROUND34_MARKER)) return source;
  if (!source.includes("if (!__cw233ExternalMatchContext || String(key || '') !== 'overview') return html;")) {
    throw new Error('Round 34 external Overview guard missing');
  }
  if (!source.includes(OLD_SANITIZER)) {
    throw new Error('Round 34 legacy Round 33 sanitizer anchor missing');
  }
  source = source.replace(OLD_SANITIZER, NEW_SANITIZER);
  if (!source.includes(ROUND34_MARKER)) throw new Error('Round 34 external Overview Form-only patch did not apply');
  return source;
}
