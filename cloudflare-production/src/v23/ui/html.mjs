export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function safeHttpUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, 'https://ciao.invalid');
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return raw;
  } catch {
    return '';
  }
}
