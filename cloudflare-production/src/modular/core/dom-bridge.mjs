export function findLegacyAppRoot(documentRef = globalThis.document) {
  return documentRef?.querySelector?.('#ciao-miniapp-root') || null;
}

export function findLegacyContent(documentRef = globalThis.document) {
  return findLegacyAppRoot(documentRef)?.querySelector?.('.content') || null;
}

export function createDomBridge({ documentRef = globalThis.document } = {}) {
  return Object.freeze({
    root: () => findLegacyAppRoot(documentRef),
    content: () => findLegacyContent(documentRef),
    render(html) {
      const target = findLegacyContent(documentRef);
      if (!target) throw new Error('legacy_content_missing');
      target.innerHTML = String(html ?? '');
      return target;
    },
  });
}
