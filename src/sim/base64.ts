// Fast base64 encoder and decoder with Node.js and browser support.

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Lookup table for fast decoding (ASCII -> 6-bit value)
const DECODE_TABLE = new Uint8Array(256);
for (let i = 0; i < B64_CHARS.length; i++) {
  DECODE_TABLE[B64_CHARS.charCodeAt(i)] = i;
}

/**
 * Fast encode a Uint8Array into a base64 string.
 */
export function fastBase64Encode(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  }

  let result = '';
  const len = bytes.length;
  const rem = len % 3;
  const mainLen = len - rem;

  for (let i = 0; i < mainLen; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    result +=
      B64_CHARS[b0 >> 2] +
      B64_CHARS[((b0 & 3) << 4) | (b1 >> 4)] +
      B64_CHARS[((b1 & 15) << 2) | (b2 >> 6)] +
      B64_CHARS[b2 & 63];
  }

  if (rem === 1) {
    const b0 = bytes[mainLen];
    result += B64_CHARS[b0 >> 2] + B64_CHARS[(b0 & 3) << 4] + '==';
  } else if (rem === 2) {
    const b0 = bytes[mainLen];
    const b1 = bytes[mainLen + 1];
    result += B64_CHARS[b0 >> 2] + B64_CHARS[((b0 & 3) << 4) | (b1 >> 4)] + B64_CHARS[(b1 & 15) << 2] + '=';
  }

  return result;
}

/**
 * Fast decode a base64 string into a Uint8Array.
 */
export function fastBase64Decode(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(b64, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  let len = b64.length;
  if (len === 0) return new Uint8Array(0);

  if (b64[len - 1] === '=') len--;
  if (b64[len - 1] === '=') len--;

  const outLen = (len * 3) >> 2;
  const out = new Uint8Array(outLen);
  let p = 0;

  for (let i = 0; i < len; i += 4) {
    const b0 = DECODE_TABLE[b64.charCodeAt(i)];
    const b1 = DECODE_TABLE[b64.charCodeAt(i + 1)];
    const b2 = i + 2 < len ? DECODE_TABLE[b64.charCodeAt(i + 2)] : 0;
    const b3 = i + 3 < len ? DECODE_TABLE[b64.charCodeAt(i + 3)] : 0;

    out[p++] = (b0 << 2) | (b1 >> 4);
    if (p < outLen) out[p++] = ((b1 & 15) << 4) | (b2 >> 2);
    if (p < outLen) out[p++] = ((b2 & 3) << 6) | b3;
  }

  return out;
}
