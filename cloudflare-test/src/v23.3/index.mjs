import './home-integration.mjs';
import './tables-ui.mjs';
import './predictions-ui.mjs';

export const CiaoV233 = Object.freeze({
  version: '23.3',
  home: 'enabled',
  tables: 'enabled',
  matchCenter: 'enabled',
  predictions: 'enabled',
});

globalThis.CiaoV233 = CiaoV233;

try {
  if (typeof globalThis.dispatchEvent === 'function' && typeof globalThis.Event === 'function') {
    globalThis.dispatchEvent(new globalThis.Event('ciao-v233-ready'));
  }
} catch {}