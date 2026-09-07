import { COMPETITION_KEYS, getCompetitionConfig } from '../matches/competition-config.mjs';
import { createPredictionsDataClient } from './data-client.mjs';
import { createPredictionsController } from './controller.mjs';
import { renderPredictionsView } from './view.mjs';

const MOUNT_ID = 'ciao-native-predictions-root';

function ensureMount(documentRef) {
  let mount = documentRef.getElementById?.(MOUNT_ID);
  if (mount) return mount;
  mount = documentRef.createElement('section');
  mount.id = MOUNT_ID;
  mount.hidden = true;
  mount.setAttribute?.('aria-live', 'polite');
  const root = documentRef.getElementById?.('ciao-miniapp-root') || documentRef.body;
  root?.appendChild?.(mount);
  return mount;
}

function themeFor(snapshot) {
  if (!snapshot?.competition) return 'serie-a';
  try { return getCompetitionConfig(snapshot.competition).theme; }
  catch { return 'serie-a'; }
}

function parseDelta(value) {
  const match = String(value ?? '').match(/^([ha]):(-?\d+)$/);
  if (!match) return null;
  return { side: match[1], delta: Number(match[2]) };
}

export function installPredictionsScreen(
  documentRef = globalThis.document,
  {
    controller: injectedController = null,
    dataClient = null,
    renderView = renderPredictionsView,
    defer = fn => setTimeout(fn, 0),
  } = {},
) {
  if (!documentRef?.addEventListener || !documentRef?.createElement) return null;
  const mount = ensureMount(documentRef);
  let controller = injectedController;

  function paint(snapshot) {
    const stage = mount.querySelector?.('.cw-pred-native-stages');
    const stageLeft = Number(stage?.scrollLeft ?? 0);
    const top = Number(mount.scrollTop ?? 0);
    mount.dataset.theme = themeFor(snapshot);
    mount.hidden = snapshot?.open !== true;
    if (snapshot?.open !== true) {
      mount.innerHTML = '';
      return;
    }
    mount.innerHTML = renderView({ ...snapshot, competitions: COMPETITION_KEYS.map(key => getCompetitionConfig(key)) });
    mount.scrollTop = top;
    const nextStage = mount.querySelector?.('.cw-pred-native-stages');
    if (nextStage?.scrollTo) nextStage.scrollTo({ left: stageLeft, top: 0, behavior: 'instant' });
    else if (nextStage) nextStage.scrollLeft = stageLeft;
  }

  if (!controller) {
    controller = createPredictionsController({
      dataClient: dataClient || createPredictionsDataClient(),
      render: paint,
      documentRef,
    });
  }

  function navHandler(event) {
    const target = event?.target;
    const nav = target?.closest?.('button[data-tab]');
    if (!nav) return;
    defer(() => {
      if (nav?.dataset?.tab === 'mine') controller.open();
      else controller.close();
    });
  }

  async function mountHandler(event) {
    const target = event?.target;
    if (!target?.closest) return;

    const action = target.closest('[data-pred-action]');
    if (action) {
      const name = action.dataset?.predAction;
      if (name === 'hub') controller.openHub();
      else if (name === 'save') await controller.save().catch(() => {});
      else if (name === 'retry') await controller.refresh().catch(() => {});
      return;
    }

    const competition = target.closest('[data-pred-competition]');
    if (competition?.dataset?.predCompetition) {
      await controller.openCompetition(competition.dataset.predCompetition).catch(() => {});
      return;
    }

    const mode = target.closest('[data-pred-mode]');
    if (mode?.dataset?.predMode) {
      controller.setMode(mode.dataset.predMode);
      return;
    }

    const stage = target.closest('[data-pred-stage]');
    if (stage?.dataset?.predStage && stage.disabled !== true && stage.getAttribute?.('aria-disabled') !== 'true') {
      controller.setStage(stage.dataset.predStage);
      return;
    }

    const serieRound = target.closest('[data-pred-serie-round]');
    if (serieRound?.dataset?.predSerieRound) {
      await controller.setSerieRound(Number(serieRound.dataset.predSerieRound)).catch(() => {});
      return;
    }

    const deltaButton = target.closest('[data-pred-delta][data-pred-match]');
    if (deltaButton) {
      const parsed = parseDelta(deltaButton.dataset?.predDelta);
      if (parsed) controller.adjustScore(deltaButton.dataset?.predMatch, parsed.side, parsed.delta);
    }
  }

  documentRef.addEventListener('click', navHandler);
  mount.addEventListener?.('click', mountHandler);

  const api = Object.freeze({
    open: () => controller.open(),
    close: () => controller.close(),
    refresh: () => controller.refresh(),
    isOpen: () => controller.isOpen(),
    controller,
    destroy() {
      controller.destroy?.();
      documentRef.removeEventListener?.('click', navHandler);
      mount.removeEventListener?.('click', mountHandler);
      mount.hidden = true;
      mount.innerHTML = '';
    },
  });

  return api;
}

if (typeof document !== 'undefined') {
  globalThis.CiaoPredictionsScreen = installPredictionsScreen(document);
}
