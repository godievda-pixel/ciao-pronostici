import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBaseHtml } from '../scripts/test-baseline.mjs';

function excerpts(source, needle, radius = 900, limit = 8) {
  const text = String(source || '');
  const out = [];
  let at = 0;
  while (out.length < limit) {
    const i = text.indexOf(needle, at);
    if (i < 0) break;
    out.push(text.slice(Math.max(0, i - radius), Math.min(text.length, i + needle.length + radius)));
    at = i + needle.length;
  }
  return out;
}

test('diagnose legacy Match Center Form/context markup anchors', async () => {
  const { html, sourceUrl } = await loadBaseHtml({ includeLegacyBase:false });
  const report = {
    sourceUrl,
    formWord:excerpts(html, 'ФОРМА'),
    formWordTitle:excerpts(html, 'Форма'),
    formClass:excerpts(html, 'cw14-form'),
    context:excerpts(html, 'Контекст Серии'),
    matchTabContent:excerpts(html, 'function matchTabContent', 1800, 2),
  };
  console.log('ROUND35_DIAGNOSTIC=' + JSON.stringify(report));
  assert.equal(typeof html, 'string');
  assert.ok(html.length > 1000);
});
