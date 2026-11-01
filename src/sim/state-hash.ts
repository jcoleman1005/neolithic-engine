/**
 * A short, fast, non-cryptographic hash of a string: two 32-bit FNV-1a style
 * lanes with different seeds, as 16 hex characters. Runs the same in the
 * browser, the worker and Node, so hashes can be compared across them.
 */
export function hashString(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995);
    b ^= b >>> 15;
  }
  a ^= a >>> 16;
  a = Math.imul(a, 0x85ebca6b);
  a ^= a >>> 13;
  b = Math.imul(b ^ (b >>> 16), 0xc2b2ae35);
  b ^= b >>> 16;
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

/**
 * Fast two-lane streaming hasher for simulation state arrays and primitives.
 */
export class StateHasher {
  public a = 0x811c9dc5;
  public b = 0x01000193 ^ 0x9e3779b9;

  public updateInt(val: number): void {
    const v = val | 0;
    this.a = Math.imul(this.a ^ v, 0x01000193);
    this.b = Math.imul(this.b ^ v, 0x5bd1e995);
    this.b ^= this.b >>> 15;
  }

  public updateFloat(val: number): void {
    this.updateInt(Math.round(val * 10000));
  }

  public updateIntArray(arr: ArrayLike<number>): void {
    const len = arr.length;
    let a = this.a;
    let b = this.b;
    for (let i = 0; i < len; i++) {
      const v = arr[i] | 0;
      a = Math.imul(a ^ v, 0x01000193);
      b = Math.imul(b ^ v, 0x5bd1e995);
      b ^= b >>> 15;
    }
    this.a = a;
    this.b = b;
  }

  public updateFloatArray(arr: Float32Array): void {
    const i32 = new Int32Array(arr.buffer, arr.byteOffset, arr.length);
    this.updateIntArray(i32);
  }

  public digest(): string {
    let a = this.a;
    let b = this.b;
    a ^= a >>> 16;
    a = Math.imul(a, 0x85ebca6b);
    a ^= a >>> 13;
    b = Math.imul(b ^ (b >>> 16), 0xc2b2ae35);
    b ^= b >>> 16;
    return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
  }
}
