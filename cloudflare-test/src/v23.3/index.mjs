import './home-integration.mjs';
import './tables-ui.mjs';

export const CiaoV233 = Object.freeze({
  version: '23.3',
  home: 'enabled',
  tables: 'enabled',
  matchCenter: 'enabled',
  predictions: 'blocked',
});

globalThis.CiaoV233 = CiaoV233;

try {
  if (typeof globalThis.dispatchEvent === 'function' && typeof globalThis.Event === 'function') {
    globalThis.dispatchEvent(new globalThis.Event('ciao-v233-ready'));
  }
} catch {}
