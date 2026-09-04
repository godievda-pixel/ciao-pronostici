export const USER_FEEDBACK_ROUND37_PROFILE_BUILD = '2026-09-04-r37-profile';
export const USER_FEEDBACK_ROUND38_PROFILE_BUILD = '2026-09-04-r38-profile';

const OVERLAY_ID = 'ciao-v233-predictor-profile-overlay';
const STYLE_ID = 'ciao-v233-predictor-profile-style';
const LEGACY_CORE_API = '/api/ciao-core-api-fast-v4';
let installed = null;
let profileGeneration = 0;
let activePredictorId = 0;

function text(value) { return String(value ?? '').trim(); }
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
function initData() { return text(globalThis.Telegram?.WebApp?.initData); }

export function predictorIdFromRankingRow(row = {}) {
  const match = text(row?.user_id || row?.userId).match(/^telegram:(\d+)$/);
  const value = Number(match?.[1]);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function favoriteTeamAssetUrl(team = {}) {
  const crest = text(team?.crestUrl || team?.crest_url || team?.logo_url || team?.logoUrl || team?.logo || team?.crest);
  if (crest) return crest;
  const customEmojiId = text(team?.customEmojiId || team?.custom_emoji_id);
  return customEmojiId ? `${LEGACY_CORE_API}?asset=emoji&id=${encodeURIComponent(customEmojiId)}` : '';
}

function favoriteTeam(source = {}) {
  const team = source?.favorite_team || source?.favoriteTeam || {};
  return {
    name:text(team?.name || team?.team_name) || 'Любимый клуб',
    assetUrl:favoriteTeamAssetUrl(team),
  };
}

function ensureStyle(documentRef) {
  if (!documentRef?.head || !documentRef?.createElement || documentRef.getElementById?.(STYLE_ID)) return;
  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
#${OVERLAY_ID}{position:fixed;inset:0;z-index:92;display:grid;place-items:center;padding:18px;background:rgba(2,7,16,.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-sizing:border-box;color:#fff;font-family:inherit}
#${OVERLAY_ID}[hidden]{display:none!important}#${OVERLAY_ID} *{box-sizing:border-box}
.cw237-predictor-modal{width:min(100%,430px);max-height:min(82dvh,680px);overflow:auto;border:1px solid rgba(122,145,218,.18);border-radius:24px;background:radial-gradient(circle at 90% 0%,rgba(49,80,255,.15),transparent 34%),linear-gradient(165deg,#111d38,#080f1d 68%,#060b14);box-shadow:0 28px 80px rgba(0,0,0,.46),inset 0 1px 0 rgba(255,255,255,.04);padding:15px}
.cw237-predictor-head{display:grid;grid-template-columns:42px 1fr 42px;align-items:center;margin-bottom:14px}.cw237-predictor-head b{text-align:center;font-size:13px}.cw237-predictor-close{width:42px;height:42px;border:1px solid rgba(255,255,255,.11);border-radius:14px;background:rgba(255,255,255,.05);color:#fff;font:800 20px/1 inherit}.cw237-predictor-head>span{width:42px}
.cw237-predictor-hero{display:grid;justify-items:center;gap:7px;padding:18px 12px;border:1px solid rgba(74,102,205,.19);border-radius:19px;background:linear-gradient(145deg,rgba(38,60,123,.30),rgba(9,19,39,.55));text-align:center}.cw237-predictor-logo{display:grid;place-items:center;width:52px;height:52px;border-radius:15px;border:1px solid rgba(117,143,255,.22);background:rgba(49,80,255,.18);overflow:hidden}.cw237-predictor-logo img{width:38px;height:38px;object-fit:contain}.cw237-predictor-logo span{font-size:18px;color:rgba(180,197,255,.48)}.cw237-predictor-hero h3{margin:2px 0 0;font-size:19px}.cw237-predictor-hero p{margin:0;color:#8e9ec2;font-size:10px}
.cw237-predictor-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.cw237-predictor-stat{min-width:0;padding:11px 7px;border:1px solid rgba(255,255,255,.075);border-radius:14px;background:rgba(255,255,255,.035);text-align:center}.cw237-predictor-stat b{display:block;font-size:17px}.cw237-predictor-stat span{display:block;margin-top:4px;color:#8192ba;font-size:8px;text-transform:uppercase;letter-spacing:.04em}
.cw237-predictor-state{min-height:210px;display:grid;place-items:center;padding:26px;text-align:center;color:#93a2c4;font-size:11px;line-height:1.45}.cw237-predictor-state b{display:block;margin-bottom:7px;color:#fff;font-size:13px}.cw237-predictor-retry{margin-top:13px;min-height:39px;padding:0 15px;border:1px solid rgba(109,134,255,.25);border-radius:12px;background:rgba(49,80,255,.18);color:#fff;font:800 10px/1 inherit}
#ciao-miniapp-root .cw233-ranking-row[data-cw233-predictor-id]{cursor:pointer;touch-action:manipulation}#ciao-miniapp-root .cw233-ranking-row[data-cw233-predictor-id]:focus-visible{outline:2px solid rgba(84,114,255,.8);outline-offset:2px}
`;
  documentRef.head.appendChild(style);
}

function ensureOverlay(documentRef) {
  let overlay = documentRef?.getElementById?.(OVERLAY_ID);
  if (overlay) return overlay;
  overlay = documentRef.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  (documentRef.getElementById('ciao-miniapp-root') || documentRef.body)?.appendChild?.(overlay);
  return overlay;
}

function stat(value, label) {
  return `<div class="cw237-predictor-stat"><b>${esc(value ?? 0)}</b><span>${esc(label)}</span></div>`;
}

function teamLogo(team) {
  const favorite = favoriteTeam({ favorite_team:team });
  return favorite.assetUrl
    ? `<div class="cw237-predictor-logo"><img src="${esc(favorite.assetUrl)}" alt="${esc(favorite.name)}"></div>`
    : '<div class="cw237-predictor-logo"><span aria-hidden="true">•</span></div>';
}

export function renderPredictorProfile(profile = null, { loading = false, error = '' } = {}) {
  if (loading) {
    return `<div class="cw237-predictor-modal"><div class="cw237-predictor-head"><span></span><b>Профиль прогнозиста</b><button type="button" class="cw237-predictor-close" data-cw233-predictor-close aria-label="Закрыть">×</button></div><div class="cw237-predictor-state"><div><b>Загружаем профиль…</b><span>Статистика прогнозиста появится здесь.</span></div></div></div>`;
  }
  if (error) {
    return `<div class="cw237-predictor-modal"><div class="cw237-predictor-head"><span></span><b>Профиль прогнозиста</b><button type="button" class="cw237-predictor-close" data-cw233-predictor-close aria-label="Закрыть">×</button></div><div class="cw237-predictor-state"><div><b>Не удалось загрузить профиль</b><span>${esc(error)}</span><br><button type="button" class="cw237-predictor-retry" data-cw233-predictor-retry>Повторить</button></div></div></div>`;
  }
  const p = profile || {};
  const favorite = favoriteTeam(p);
  const displayName = text(p.display_name || p.displayName || p.name) || text(p.username) || 'Прогнозист';
  const username = text(p.username).replace(/^@/, '');
  const overall = p.overall && typeof p.overall === 'object' ? p.overall : {};
  const round = p.round && typeof p.round === 'object' ? p.round : {};
  const month = p.month && typeof p.month === 'object' ? p.month : {};
  return `<div class="cw237-predictor-modal"><div class="cw237-predictor-head"><span></span><b>Прогнозист</b><button type="button" class="cw237-predictor-close" data-cw233-predictor-close aria-label="Закрыть">×</button></div><div class="cw237-predictor-hero">${teamLogo(p.favorite_team || p.favoriteTeam)}<h3>${esc(displayName)}</h3><p>${username ? `@${esc(username)} · ` : ''}${esc(favorite.name || 'Любимый клуб не выбран')}</p></div><div class="cw237-predictor-grid">${stat(overall.rank,'место')}${stat(overall.points,'очков')}${stat(overall.exact,'точных')}${stat(overall.streak,'серия')}${stat(round.points,'за тур')}${stat(month.points,'за месяц')}</div></div>`;
}

async function publicPredictor(id, { fetchImpl = globalThis.fetch } = {}) {
  const auth = initData();
  if (!auth) throw new Error('Telegram-профиль недоступен');
  const response = await fetchImpl(LEGACY_CORE_API, {
    method:'POST',
    headers:{ 'content-type':'application/json', 'x-telegram-init-data':auth },
    body:JSON.stringify({ action:'public_predictor', user_id:Number(id) }),
  });
  let payload = null;
  try { payload = await response.json(); } catch {}
  if (!response.ok || payload?.ok === false) throw new Error(text(payload?.error) || 'Профиль пока недоступен');
  const profile = payload?.predictor || payload?.data?.predictor || null;
  if (!profile) throw new Error('Профиль пока недоступен');
  return profile;
}

export async function openPredictorProfile(id, { documentRef = globalThis.document, fetchImpl = globalThis.fetch } = {}) {
  const predictorId = Number(id);
  if (!Number.isFinite(predictorId) || predictorId <= 0 || !documentRef?.createElement) return null;
  const generation = ++profileGeneration;
  activePredictorId = predictorId;
  const overlay = ensureOverlay(documentRef);
  overlay.hidden = false;
  overlay.innerHTML = renderPredictorProfile(null, { loading:true });
  try {
    const profile = await publicPredictor(predictorId, { fetchImpl });
    if (generation !== profileGeneration || activePredictorId !== predictorId) return null;
    overlay.innerHTML = renderPredictorProfile(profile);
    return profile;
  } catch (error) {
    if (generation !== profileGeneration || activePredictorId !== predictorId) return null;
    overlay.innerHTML = renderPredictorProfile(null, { error:text(error?.message || error) || 'Профиль пока недоступен' });
    return null;
  }
}

export function closePredictorProfile(documentRef = globalThis.document) {
  profileGeneration += 1;
  activePredictorId = 0;
  const overlay = documentRef?.getElementById?.(OVERLAY_ID);
  if (overlay) {
    overlay.hidden = true;
    overlay.innerHTML = '';
  }
}

export function installPredictorProfileUi(documentRef = globalThis.document, rootRef = globalThis) {
  if (!documentRef?.addEventListener) return null;
  if (installed) return installed;
  ensureStyle(documentRef);
  ensureOverlay(documentRef);

  const onClick = event => {
    const target = event?.target;
    const close = target?.closest?.('[data-cw233-predictor-close]');
    const overlay = documentRef.getElementById?.(OVERLAY_ID);
    if (close || target === overlay) {
      event.preventDefault?.();
      closePredictorProfile(documentRef);
      return;
    }
    const retry = target?.closest?.('[data-cw233-predictor-retry]');
    if (retry && activePredictorId) {
      event.preventDefault?.();
      void openPredictorProfile(activePredictorId, { documentRef });
      return;
    }
    const row = target?.closest?.('[data-cw233-predictor-id]');
    if (!row || target?.closest?.('button,a,input,select,textarea')) return;
    const id = Number(row.dataset?.cw233PredictorId);
    if (!Number.isFinite(id) || id <= 0) return;
    event.preventDefault?.();
    void openPredictorProfile(id, { documentRef });
  };

  const onKeydown = event => {
    if (event?.key !== 'Enter' && event?.key !== ' ') return;
    const row = event?.target?.closest?.('[data-cw233-predictor-id]');
    if (!row) return;
    const id = Number(row.dataset?.cw233PredictorId);
    if (!Number.isFinite(id) || id <= 0) return;
    event.preventDefault?.();
    void openPredictorProfile(id, { documentRef });
  };

  documentRef.addEventListener('click', onClick, true);
  documentRef.addEventListener('keydown', onKeydown);

  installed = Object.freeze({
    open:id => openPredictorProfile(id, { documentRef }),
    close:() => closePredictorProfile(documentRef),
    disconnect() {
      documentRef.removeEventListener?.('click', onClick, true);
      documentRef.removeEventListener?.('keydown', onKeydown);
      installed = null;
    },
  });
  rootRef.CiaoV233PredictorProfile = installed;
  return installed;
}

if (typeof document !== 'undefined') {
  const boot = () => installPredictorProfileUi(document, globalThis);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
}
