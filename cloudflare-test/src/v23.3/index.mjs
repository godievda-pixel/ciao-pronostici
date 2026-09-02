import './navigation-ui.mjs';
import './home-integration.mjs';
import './tables-ui.mjs';
import './serie-a-legacy-bridge.mjs';
import './predictions-ui.mjs';
import './ranking-ui.mjs';
import './premium-polish-ui.mjs';
import './round6-polish-ui.mjs';

export const CiaoV233 = Object.freeze({
  version: '23.3',
  navigation: 'enabled',
  home: 'enabled',
  tables: 'enabled',
  matchCenter: 'enabled',
  predictions: 'enabled',
  ranking: 'enabled',
  premiumPolish: 'enabled',
  round6Polish: 'enabled',
});

globalThis.CiaoV233 = CiaoV233;

try {
  if (typeof globalThis.dispatchEvent === 'function' && typeof globalThis.Event === 'function') {
    globalThis.dispatchEvent(new globalThis.Event('ciao-v233-ready'));
  }
} catch {}
