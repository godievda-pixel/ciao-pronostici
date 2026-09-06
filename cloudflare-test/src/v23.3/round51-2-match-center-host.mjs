export const ROUND512_DRAWER_ID = 'ciao-v2512-match-center-drawer';
export const ROUND512_SNAP_HEIGHTS = Object.freeze({
  compact:46,
  standard:78,
  expanded:94,
});
export const ROUND512_DRAG_THRESHOLD = 56;

const SNAP_ORDER = Object.freeze(['compact','standard','expanded']);

function text(value) {
  return String(value ?? '').trim();
}

function canonicalSnap(value) {
  return SNAP_ORDER.includes(value) ? value : 'standard';
}

export function round512DrawerStyle(snap = 'standard') {
  const key = canonicalSnap(snap);
  return {
    position:'fixed',
    bottom:'0',
    left:'0',
    right:'0',
    height:`${ROUND512_SNAP_HEIGHTS[key]}dvh`,
    maxHeight:`${ROUND512_SNAP_HEIGHTS.expanded}dvh`,
    zIndex:'58',
    overflow:'hidden',
    borderRadius:'24px 24px 0 0',
    background:'#071626',
    boxShadow:'0 -18px 54px rgba(0,0,0,.42)',
    transition:'height .22s ease, transform .18s ease',
    touchAction:'pan-x',
  };
}

export function resolveRound512DrawerSnap(current, deltaY, threshold = ROUND512_DRAG_THRESHOLD) {
  const snap = canonicalSnap(current);
  const delta = Number(deltaY);
  if (!Number.isFinite(delta) || Math.abs(delta) < Math.max(0, Number(threshold) || 0)) return snap;
  const index = SNAP_ORDER.indexOf(snap);
  if (delta < 0) return SNAP_ORDER[Math.min(SNAP_ORDER.length - 1, index + 1)];
  if (index === 0) return 'dismiss';
  return SNAP_ORDER[index - 1];
}

function rootFor(documentRef) {
  return documentRef?.getElementById?.('ciao-miniapp-root') || documentRef?.body || documentRef?.documentElement || null;
}

function setData(node, key, value) {
  if (node?.dataset) node.dataset[key] = value;
  else node?.setAttribute?.(`data-${key.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)}`, value);
}

export function createRound512MatchCenterHost(documentRef = globalThis.document) {
  if (!documentRef?.createElement) throw new Error('round512_match_center_document_required');

  let node = documentRef.getElementById?.(ROUND512_DRAWER_ID) || null;
  let handle = node?.querySelector?.('[data-cw512-drawer-handle]') || null;
  let scroll = node?.querySelector?.('[data-cw512-drawer-scroll]') || null;

  if (!node) {
    node = documentRef.createElement('section');
    node.id = ROUND512_DRAWER_ID;
    setData(node, 'cw512Drawer', 'true');
    node.hidden = true;
    node.setAttribute?.('aria-hidden', 'true');
    Object.assign(node.style || {}, round512DrawerStyle('standard'));

    handle = documentRef.createElement('button');
    handle.type = 'button';
    handle.setAttribute?.('aria-label', 'Изменить высоту матч-центра');
    setData(handle, 'cw512DrawerHandle', 'true');
    Object.assign(handle.style || {}, {
      display:'block',
      width:'52px',
      height:'22px',
      margin:'0 auto',
      padding:'0',
      border:'0',
      background:'transparent',
      touchAction:'none',
      cursor:'ns-resize',
    });
    const grip = documentRef.createElement('span');
    Object.assign(grip.style || {}, {
      display:'block',
      width:'34px',
      height:'4px',
      margin:'9px auto',
      borderRadius:'999px',
      background:'rgba(255,255,255,.34)',
    });
    handle.appendChild?.(grip);

    scroll = documentRef.createElement('div');
    setData(scroll, 'cw512DrawerScroll', 'true');
    Object.assign(scroll.style || {}, {
      height:'calc(100% - 22px)',
      overflowY:'auto',
      overflowX:'hidden',
      overscrollBehavior:'contain',
      WebkitOverflowScrolling:'touch',
      scrollbarWidth:'none',
    });

    node.appendChild?.(handle);
    node.appendChild?.(scroll);
    rootFor(documentRef)?.appendChild?.(node);
  }

  let boundRuntime = null;
  let snap = 'standard';
  let drag = null;
  const eventTarget = documentRef.defaultView || globalThis;

  function applySnap(next = 'standard') {
    snap = canonicalSnap(next);
    setData(node, 'cw512DrawerSnap', snap);
    Object.assign(node.style || {}, round512DrawerStyle(snap));
    node.style.transform = '';
    return snap;
  }

  function show() {
    node.hidden = false;
    node.removeAttribute?.('aria-hidden');
    node.style.display = 'block';
  }

  function hide() {
    drag = null;
    node.style.transform = '';
    node.hidden = true;
    node.setAttribute?.('aria-hidden', 'true');
    node.style.display = 'none';
  }

  function onClick(event) {
    if (!boundRuntime) return;

    const viewNode = event?.target?.closest?.('[data-cw512-user-view]');
    if (viewNode && node.contains?.(viewNode) && viewNode.getAttribute?.('aria-disabled') !== 'true') {
      event.preventDefault?.();
      event.stopPropagation?.();
      void boundRuntime.selectUserView?.(text(viewNode.dataset?.cw512UserView));
      return;
    }

    const uiNode = event?.target?.closest?.('[data-cw502-action]');
    if (uiNode && node.contains?.(uiNode)) {
      const action = text(uiNode.dataset?.cw502Action);
      const value = action === 'lineup-team'
        ? text(uiNode.dataset?.cw502LineupTeam)
        : action === 'lineup-disclosure'
          ? text(uiNode.dataset?.cw502LineupDisclosure)
          : action === 'shot'
            ? text(uiNode.dataset?.cw502ShotAction)
            : '';
      event.preventDefault?.();
      event.stopPropagation?.();
      boundRuntime.uiAction?.(action, value);
      return;
    }

    const actionNode = event?.target?.closest?.('[data-cw239-action]');
    if (!actionNode || !node.contains?.(actionNode)) return;
    const action = text(actionNode.dataset?.cw239Action);
    event.preventDefault?.();
    event.stopPropagation?.();
    if (action === 'back') boundRuntime.back?.();
    else if (action === 'retry-base') void boundRuntime.retryBase?.();
    else if (action === 'retry-section') void boundRuntime.retrySection?.(text(actionNode.dataset?.cw239Section));
  }

  function onPointerDown(event) {
    const target = event?.target?.closest?.('[data-cw512-drawer-handle]');
    if (!target || !node.contains?.(target)) return;
    const y = Number(event?.clientY);
    if (!Number.isFinite(y)) return;
    drag = { startY:y, pointerId:event?.pointerId ?? null };
    target.setPointerCapture?.(event?.pointerId);
    event.preventDefault?.();
  }

  function onPointerMove(event) {
    if (!drag) return;
    if (drag.pointerId !== null && event?.pointerId !== drag.pointerId) return;
    const y = Number(event?.clientY);
    if (!Number.isFinite(y)) return;
    const delta = y - drag.startY;
    node.style.transition = 'none';
    node.style.transform = `translateY(${Math.max(-54, Math.min(120, delta))}px)`;
    event.preventDefault?.();
  }

  function finishDrag(event, cancelled = false) {
    if (!drag) return;
    if (drag.pointerId !== null && event?.pointerId !== drag.pointerId) return;
    const startY = drag.startY;
    drag = null;
    node.style.transition = round512DrawerStyle(snap).transition;
    node.style.transform = '';
    if (cancelled) return;
    const y = Number(event?.clientY);
    const next = resolveRound512DrawerSnap(snap, Number.isFinite(y) ? y - startY : 0);
    if (next === 'dismiss') {
      boundRuntime?.back?.();
      return;
    }
    applySnap(next);
  }

  function onPointerUp(event) { finishDrag(event, false); }
  function onPointerCancel(event) { finishDrag(event, true); }

  node.addEventListener?.('click', onClick);
  handle?.addEventListener?.('pointerdown', onPointerDown);
  eventTarget?.addEventListener?.('pointermove', onPointerMove, { passive:false });
  eventTarget?.addEventListener?.('pointerup', onPointerUp);
  eventTarget?.addEventListener?.('pointercancel', onPointerCancel);
  applySnap('standard');

  return Object.freeze({
    node,
    handle,
    scroll,
    bind(runtime) { boundRuntime = runtime; },
    render(html) {
      if (scroll) scroll.innerHTML = String(html || '');
      show();
    },
    show,
    hide,
    setSnap:applySnap,
    currentSnap:() => snap,
    scrollToTop() { if (scroll) scroll.scrollTop = 0; },
    destroy() {
      boundRuntime = null;
      node.removeEventListener?.('click', onClick);
      handle?.removeEventListener?.('pointerdown', onPointerDown);
      eventTarget?.removeEventListener?.('pointermove', onPointerMove, { passive:false });
      eventTarget?.removeEventListener?.('pointerup', onPointerUp);
      eventTarget?.removeEventListener?.('pointercancel', onPointerCancel);
      node.remove?.();
    },
  });
}
