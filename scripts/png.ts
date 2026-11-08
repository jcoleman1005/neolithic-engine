import { deflateSync, inflateSync } from 'node:zlib';

const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

function crc32(data: Uint8Array): number {
  let c = -1;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

/** Encodes 8-bit RGB pixels (3 bytes each, row by row) as a PNG, with no dependencies. */
export function encodePng(width: number, height: number, rgb: Uint8Array): Buffer {
  if (rgb.length !== width * height * 3) throw new Error('rgb length does not match width x height x 3');
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: RGB
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const from = y * width * 3;
    Buffer.from(rgb.buffer, rgb.byteOffset + from, width * 3).copy(raw, y * (width * 3 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

export interface DecodedPng {
  readonly width: number;
  readonly height: number;
  /** RGBA, 4 bytes per pixel, row by row. */
  readonly rgba: Uint8Array;
}

/** Encodes 8-bit RGBA pixels as a PNG (used for diff images, which need no alpha tricks: alpha is 255). */
export function encodePngRgba(width: number, height: number, rgba: Uint8Array): Buffer {
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i];
    rgb[j + 1] = rgba[i + 1];
    rgb[j + 2] = rgba[i + 2];
  }
  return encodePng(width, height, rgb);
}

/**
 * Decodes the PNGs that Chromium writes: 8-bit greyscale, RGB or RGBA, not interlaced. Anything else
 * throws, so a surprise format fails loudly instead of comparing garbage.
 */
export function decodePng(buf: Uint8Array): DecodedPng {
  const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  if (b.length < 8 || b.readUInt32BE(0) !== 0x89504e47) throw new Error('Not a PNG');
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = -1;
  const idat: Buffer[] = [];
  while (pos + 8 <= b.length) {
    const len = b.readUInt32BE(pos);
    const type = b.toString('latin1', pos + 4, pos + 8);
    const data = b.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8) throw new Error(`Unsupported PNG bit depth ${data[8]}`);
      colorType = data[9];
      if (data[12] !== 0) throw new Error('Interlaced PNGs are not supported');
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }
  const channels = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 6 ? 4 : 0;
  if (channels === 0) throw new Error(`Unsupported PNG colour type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  if (raw.length !== (stride + 1) * height) throw new Error('PNG data has the wrong length');
  const px = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let i = 0; i < stride; i++) {
      const x = raw[src + i];
      const left = i >= channels ? px[dst + i - channels] : 0;
      const up = y > 0 ? px[dst - stride + i] : 0;
      const upLeft = y > 0 && i >= channels ? px[dst - stride + i - channels] : 0;
      let v: number;
      switch (filter) {
        case 0: v = x; break;
        case 1: v = x + left; break;
        case 2: v = x + up; break;
        case 3: v = x + ((left + up) >> 1); break;
        case 4: {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          v = x + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
          break;
        }
        default: throw new Error(`Bad PNG filter ${filter}`);
      }
      px[dst + i] = v & 255;
    }
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    if (channels === 1) {
      rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = px[i];
      rgba[i * 4 + 3] = 255;
    } else {
      rgba[i * 4] = px[i * channels];
      rgba[i * 4 + 1] = px[i * channels + 1];
      rgba[i * 4 + 2] = px[i * channels + 2];
      rgba[i * 4 + 3] = channels === 4 ? px[i * 4 + 3] : 255;
    }
  }
  return { width, height, rgba };
}
