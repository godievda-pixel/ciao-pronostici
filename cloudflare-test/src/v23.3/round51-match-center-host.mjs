export const ROUND51_HOST_ID = 'ciao-v251-match-center-drawer';
export const ROUND51_DRAG_THRESHOLD = 72;

const SNAP_ORDER = Object.freeze(['compact', 'standard', 'expanded']);

function text(value) {
  return String(value ?? '').trim();
}

function viewportHeight(documentRef) {
  return Math.max(1, Number(documentRef?.defaultView?.innerHeight ?? globalThis.innerHeight) || 800);
}

export function round51SnapHeights(viewport) {
  const height = Math.max(1, Number(viewport) || 1);
  return Object.freeze({
    compact:Math.round(height * 0.46),
    standard:Math.round(height * 0.78),
    expanded:Math.round(height * 0.94),
  });
}

function canonicalSnap(value) {
  const key = text(value).toLowerCase();
  return SNAP_ORDER.includes(key) ? key : 'standard';
}

export function resolveRound51Snap({ viewportHeight:height, snap, deltaY } = {}) {
  const heights = round51SnapHeights(height);
  const current = canonicalSnap(snap);
  const delta = Number(deltaY) || 0;
  const currentIndex = SNAP_ORDER.indexOf(current);

  if (Math.abs(delta) < ROUND51_DRAG_THRESHOLD) {
    return Object.freeze({ action:'snap', snap:current, height:heights[current] });
  }
  if (delta > 0 && current === 'compact') return Object.freeze({ action:'dismiss' });

  const nextIndex = delta < 0
    ? Math.min(SNAP_ORDER.length - 1, currentIndex + 1)
    : Math.max(0, currentIndex - 1);
  const next = SNAP_ORDER[nextIndex];
  return Object.freeze({ action:'snap', snap:next, height:heights[next] });
}

function rootFor(documentRef) {
  return documentRef?.getElementById?.('ciao-miniapp-root') || documentRef?.body || null;
}

function setStyles(node, values) {
  Object.assign(node?.style || {}, values);
}

function closestInside(node, target, selector) {
  const found = target?.closest?.(selector) || null;
  return found && node?.contains?.(found) ? found : null;
}

export function createRound51MatchCenterHost(documentRef = globalThis.document) {
  if (!documentRef?.createElement) throw new Error('round51_match_center_document_required');

  const existing = documentRef.getElementById?.(ROUND51_HOST_ID) || null;
  const node = existing || documentRef.createElement('section');
  if (!existing) {
    node.id = ROUND51_HOST_ID;
    node.dataset.cw51MatchCenterDrawer = '1';
    node.dataset.cw51Snap = 'standard';
    node.hidden = true;
    node.setAttribute?.('aria-hidden', 'true');
    node.setAttribute?.('role', 'dialog');
    node.setAttribute?.('aria-label', 'Матч-центр');
    setStyles(node, {
      position:'fixed',
      left:'0px',
      right:'0px',
      bottom:'0px',
      zIndex:'58',
      overflow:'hidden',
      background:'#071626',
      borderRadius:'24px 24px 0 0',
      boxShadow:'0 -18px 48px rgba(0,0,0,.34)',
      transition:'height .22s ease, transform .22s ease',
      maxHeight:'94vh',
      width:'100%',
      boxSizing:'border-box',
    });

    const handle = documentRef.createElement('div');
    handle.className = 'cw51-drawer-handle';
    handle.dataset.cw51DrawerHandle = '1';
    handle.setAttribute?.('role', 'button');
    handle.setAttribute?.('aria-label', 'Изменить высоту матч-центра');
    handle.setAttribute?.('tabindex', '0');
    setStyles(handle, {
      display:'grid',
      placeItems:'center',
      height:'28px',
      cursor:'grab',
      touchAction:'none',
      userSelect:'none',
    });

    const grip = documentRef.createElement('span');
    grip.className = 'cw51-drawer-grip';
    grip.setAttribute?.('aria-hidden', 'true');
    setStyles(grip, {
      display:'block',
      width:'42px',
      height:'4px',
      borderRadius:'99px',
      background:'rgba(255,255,255,.38)',
    });
    handle.appendChild?.(grip);

    const scroll = documentRef.createElement('div');
    scroll.className = 'cw51-drawer-scroll';
    scroll.dataset.cw51DrawerScroll = '1';
    setStyles(scroll, {
      height:'calc(100% - 28px)',
      overflowY:'auto',
      overflowX:'hidden',
      overscrollBehavior:'contain',
      scrollbarWidth:'none',
      WebkitOverflowScrolling:'touch',
    });

    node.appendChild?.(handle);
    node.appendChild?.(scroll);
    rootFor(documentRef)?.appendChild?.(node);
  }

  const handle = node.querySelector?.('[data-cw51-drawer-handle]') || null;
  const scroll = node.querySelector?.('[data-cw51-drawer-scroll]') || null;
  if (!handle || !scroll) throw new Error('round51_match_center_host_structure_invalid');

  let boundRuntime = null;
  let snap = canonicalSnap(node.dataset?.cw51Snap);
  let drag = null;

  function setSnap(next) {
    snap = canonicalSnap(next);
    const heights = round51SnapHeights(viewportHeight(documentRef));
    node.dataset.cw51Snap = snap;
    node.style.height = `${heights[snap]}px`;
    node.style.transform = 'translateY(0)';
    return snap;
  }

  function show() {
    node.hidden = false;
    node.removeAttribute?.('aria-hidden');
    node.style.display = 'block';
    setSnap(snap || 'standard');
  }

  function hide() {
    drag = null;
    node.hidden = true;
    node.setAttribute?.('aria-hidden', 'true');
    node.style.display = 'none';
  }

  function render(html) {
    scroll.innerHTML = String(html || '');
    show();
  }

  function pointerDown(event) {
    const targetHandle = closestInside(node, event?.target, '[data-cw51-drawer-handle]');
    if (!targetHandle) return;
    const y = Number(event?.clientY);
    if (!Number.isFinite(y)) return;
    drag = {
      pointerId:event?.pointerId,
      startY:y,
      startSnap:snap,
      startHeight:round51SnapHeights(viewportHeight(documentRef))[snap],
    };
    targetHandle.setPointerCapture?.(event?.pointerId);
    if (targetHandle.style) targetHandle.style.cursor = 'grabbing';
    node.style.transition = 'none';
    event?.preventDefault?.();
  }

  function pointerMove(event) {
    if (!drag) return;
    if (drag.pointerId !== undefined && event?.pointerId !== undefined && event.pointerId !== drag.pointerId) return;
    const y = Number(event?.clientY);
    if (!Number.isFinite(y)) return;
    const deltaY = y - drag.startY;
    const heights = round51SnapHeights(viewportHeight(documentRef));
    const min = Math.max(80, heights.compact - ROUND51_DRAG_THRESHOLD * 1.5);
    const max = heights.expanded;
    const nextHeight = Math.max(min, Math.min(max, drag.startHeight - deltaY));
    node.style.height = `${Math.round(nextHeight)}px`;
    event?.preventDefault?.();
  }

  function finishDrag(event, cancelled = false) {
    if (!drag) return;
    if (drag.pointerId !== undefined && event?.pointerId !== undefined && event.pointerId !== drag.pointerId) return;
    const active = drag;
    drag = null;
    if (handle?.style) handle.style.cursor = 'grab';
    node.style.transition = 'height .22s ease, transform .22s ease';
    const y = Number(event?.clientY);
    const deltaY = cancelled || !Number.isFinite(y) ? 0 : y - active.startY;
    const result = resolveRound51Snap({
      viewportHeight:viewportHeight(documentRef),
      snap:active.startSnap,
      deltaY,
    });
    if (result.action === 'dismiss') {
      boundRuntime?.back?.();
      return;
    }
    setSnap(result.snap);
  }

  function clickHandler(event) {
    if (!boundRuntime) return;

    const uiNode = closestInside(node, event?.target, '[data-cw502-action]');
    if (uiNode) {
      const action = text(uiNode.dataset?.cw502Action);
      const value = action === 'lineup-team'
        ? text(uiNode.dataset?.cw502LineupTeam)
        : action === 'lineup-disclosure'
          ? text(uiNode.dataset?.cw502LineupDisclosure)
          : action === 'shot'
            ? text(uiNode.dataset?.cw502ShotAction)
            : '';
      event?.preventDefault?.();
      event?.stopPropagation?.();
      boundRuntime.uiAction?.(action, value);
      return;
    }

    const actionNode = closestInside(node, event?.target, '[data-cw239-action]');
    if (actionNode) {
      const action = text(actionNode.dataset?.cw239Action);
      event?.preventDefault?.();
      event?.stopPropagation?.();
      if (action === 'back') boundRuntime.back?.();
      else if (action === 'retry-base') void boundRuntime.retryBase?.();
      else if (action === 'retry-section') void boundRuntime.retrySection?.(text(actionNode.dataset?.cw239Section));
      return;
    }

    const tabNode = closestInside(node, event?.target, '[data-cw239-tab]');
    if (!tabNode || tabNode.getAttribute?.('aria-disabled') === 'true') return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    void boundRuntime.selectTab?.(text(tabNode.dataset?.cw239Tab));
  }

  node.addEventListener?.('click', clickHandler);
  node.addEventListener?.('pointerdown', pointerDown);
  node.addEventListener?.('pointermove', pointerMove);
  node.addEventListener?.('pointerup', event => finishDrag(event, false));
  node.addEventListener?.('pointercancel', event => finishDrag(event, true));

  setSnap(snap);

  return Object.freeze({
    node,
    bind(runtime) { boundRuntime = runtime || null; },
    render,
    show,
    hide,
    setSnap,
    currentSnap:() => snap,
    scrollToTop() { scroll.scrollTop = 0; },
    destroy() {
      boundRuntime = null;
      drag = null;
      node.removeEventListener?.('click', clickHandler);
      node.removeEventListener?.('pointerdown', pointerDown);
      node.removeEventListener?.('pointermove', pointerMove);
      node.remove?.();
    },
  });
}
