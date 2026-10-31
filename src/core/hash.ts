/** Two-lane FNV-style hash over numbers and typed arrays; 16 hex characters. */
export class Hasher {
  private a = 0x811c9dc5;
  private b = 0x01000193 ^ 0x9e3779b9;
  private readonly scratch = new Float64Array(1);
  private readonly words = new Uint32Array(this.scratch.buffer);

  private word(w: number): void {
    this.a = Math.imul(this.a ^ w, 0x01000193);
    this.b = Math.imul(this.b ^ w, 0x5bd1e995);
    this.b ^= this.b >>> 15;
  }

  num(v: number): void {
    this.scratch[0] = v;
    this.word(this.words[0]);
    this.word(this.words[1]);
  }

  array(values: ArrayLike<number>): void {
    for (let i = 0; i < values.length; i++) this.num(values[i]);
  }

  digest(): string {
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
