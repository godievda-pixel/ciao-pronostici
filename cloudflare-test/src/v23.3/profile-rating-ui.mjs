import { createPredictionClient } from './prediction-client.mjs';

export const USER_FEEDBACK_ROUND15_PROFILE_BUILD = '2026-09-03-r15-profile';

let client = null;
let cachedPoints = 0;
let hasLoadedPoints = false;
let profileActive = false;
let loadGeneration = 0;

function text(value) {
  return String(value ?? '').trim();
}

function initData() {
  return text(globalThis.Telegram?.WebApp?.initData);
}

function currentRankingRow(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  const marked = list.find(row => row?.is_current === true);
  if (marked) return marked;
  const telegramId = text(globalThis.Telegram?.WebApp?.initDataUnsafe?.user?.id);
  if (!telegramId) return null;
  return list.find(row => text(row?.user_id) === `telegram:${telegramId}`) || null;
}

function profileStatsGrid(documentRef) {
  return documentRef?.querySelector?.('#ciao-miniapp-root .content .stats-grid') || null;
}

export function applyProfileRankingPoints(documentRef = globalThis.document, points = 0) {
  const grid = profileStatsGrid(documentRef);
  if (!grid) return false;
  const stat = grid.querySelector?.('.stat:first-child') || grid.firstElementChild;
  const value = stat?.querySelector?.('b,strong,[data-value]');
  if (!stat || !value) return false;
  const normalized = Number.isFinite(Number(points)) ? Math.trunc(Number(points)) : 0;
  value.textContent = String(normalized);
  stat.dataset.cw233ProfilePoints = 'true';
  value.dataset.cw233ProfilePoints = 'true';
  return true;
}

function applyCached(documentRef) {
  if (!profileActive || !hasLoadedPoints) return false;
  return applyProfileRankingPoints(documentRef, cachedPoints);
}

async function loadProfilePoints(documentRef = globalThis.document, { force = false } = {}) {
  const auth = initData();
  if (!auth) return false;
  const generation = ++loadGeneration;
  client = client || createPredictionClient({ initData:auth });
  try {
    const ranking = await client.rankings({ scope:'overall' }, force ? { force:true } : undefined);
    if (generation !== loadGeneration) return false;
    const current = currentRankingRow(ranking);
    cachedPoints = Number(current?.points) || 0;
    hasLoadedPoints = true;
    if (profileActive) applyProfileRankingPoints(documentRef, cachedPoints);
    return true;
  } catch {
    if (generation !== loadGeneration) return false;
    if (!hasLoadedPoints) {
      cachedPoints = 0;
      hasLoadedPoints = true;
    }
    if (profileActive) applyProfileRankingPoints(documentRef, cachedPoints);
    return false;
  }
}

function scheduleProfileApply(documentRef) {
  const run = () => {
    applyCached(documentRef);
    void loadProfilePoints(documentRef);
  };
  if (typeof globalThis.queueMicrotask === 'function') globalThis.queueMicrotask(run);
  else globalThis.setTimeout?.(run, 0);
}

function schedulePrefetch(documentRef) {
  const run = () => void loadProfilePoints(documentRef);
  if (initData()) {
    if (typeof globalThis.queueMicrotask === 'function') globalThis.queueMicrotask(run);
    else globalThis.setTimeout?.(run, 0);
    return;
  }
  if (typeof globalThis.requestIdleCallback === 'function') globalThis.requestIdleCallback(run, { timeout:900 });
  else globalThis.setTimeout?.(run, 400);
}

export function installProfileRatingUi(documentRef = globalThis.document) {
  if (!documentRef?.addEventListener) return null;
  schedulePrefetch(documentRef);
  const onClick = event => {
    const nav = event.target?.closest?.('#ciao-miniapp-root .nav button[data-tab]');
    if (nav) {
      profileActive = nav.dataset?.tab === 'profile';
      if (profileActive) scheduleProfileApply(documentRef);
      return;
    }
    if (profileActive) {
      const run = () => applyCached(documentRef);
      if (typeof globalThis.queueMicrotask === 'function') globalThis.queueMicrotask(run);
      else globalThis.setTimeout?.(run, 0);
    }
  };
  documentRef.addEventListener('click', onClick);
  return Object.freeze({
    refresh:() => loadProfilePoints(documentRef, { force:true }),
    apply:() => applyCached(documentRef),
    disconnect:() => documentRef.removeEventListener?.('click', onClick),
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => installProfileRatingUi(document), { once:true });
  } else {
    installProfileRatingUi(document);
  }
}
