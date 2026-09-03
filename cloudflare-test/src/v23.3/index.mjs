import './navigation-ui.mjs';
import './home-integration.mjs';
import './tables-ui.mjs';
import './serie-a-legacy-bridge.mjs';
import './predictions-ui.mjs';
import './ranking-ui.mjs';
import './profile-rating-ui.mjs';
import './premium-polish-ui.mjs';
import './round6-polish-ui.mjs';
import './round7-regression-fixes.mjs';
import './round8-performance-premium.mjs';
import './round9-regression-fixes.mjs';
import './round10-regression-fixes.mjs';
import './round11-performance-themes.mjs';
import './round12-stability-performance.mjs';
import './round13-mobile-regressions.mjs';
import './round16-runtime.mjs';

export const CiaoV233 = Object.freeze({
  version: '23.3',
  navigation: 'enabled',
  home: 'enabled',
  tables: 'enabled',
  matchCenter: 'enabled',
  predictions: 'enabled',
  ranking: 'enabled',
  profileRating: 'enabled',
  premiumPolish: 'enabled',
  round6Polish: 'enabled',
  round7RegressionFixes: 'enabled',
  round8PerformancePremium: 'enabled',
  round9RegressionFixes: 'enabled',
  round10RegressionFixes: 'enabled',
  round11PerformanceThemes: 'enabled',
  round12StabilityPerformance: 'enabled',
  round13MobileRegressions: 'enabled',
  round16Runtime: 'enabled',
});

globalThis.CiaoV233 = CiaoV233;

try {
  if (typeof globalThis.dispatchEvent === 'function' && typeof globalThis.Event === 'function') {
    globalThis.dispatchEvent(new globalThis.Event('ciao-v233-ready'));
  }
} catch {}