import { createHash } from 'node:crypto';

const REVISION_RE = /^[0-9a-f]{12}$/;

function asBuffer(input) {
  if (typeof input === 'string') return Buffer.from(input, 'utf8');
  if (input instanceof Uint8Array) {
    return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  }
  throw new TypeError('release revision input must be a string or Uint8Array');
}

export function releaseRevision(input) {
  return createHash('sha256').update(asBuffer(input)).digest('hex').slice(0, 12);
}

export function isReleaseRevision(value) {
  return REVISION_RE.test(String(value ?? ''));
}
