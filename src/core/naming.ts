/**
 * Chronicle names: invented words plus English descriptive words.
 * Every function is a pure hash of its inputs. Nothing here touches the
 * simulation's random stream, so names change no outcome (Agent rule 11).
 *
 * A "tongue" is a small syllable set. A band's tongue is seeded from its
 * founder's lineage; a band that splits off inherits its parent's tongue with
 * a slight drift (one syllable replaced).
 */

export type Tongue = readonly string[];

const ONSETS = ['k', 'v', 'sh', 'm', 't', 'r', 'n', 'z', 'd', 'h', 'l', 'b', 'g', 's', 'th'];
const NUCLEI = ['a', 'e', 'i', 'o', 'u', 'a', 'e', 'o'];
const CODAS = ['sh', 'rn', 'n', 'l', 'k', 'm', 'r', 'th', '', ''];

export const TONGUE_SIZE = 6;

/** 32-bit hash of up to three integers and a salt (FNV-style with avalanche). */
export function hash32(a: number, b = 0, salt = 0): number {
  let h = (2166136261 ^ salt) >>> 0;
  for (const w of [a, b]) {
    h ^= w & 0xffff;
    h = Math.imul(h, 16777619) >>> 0;
    h ^= (w >>> 16) & 0xffff;
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A consonant-vowel syllable; a word gets one closing consonant at its end. */
function syllable(h: number): string {
  const o = ONSETS[h % ONSETS.length];
  h = Math.floor(h / ONSETS.length);
  return o + NUCLEI[h % NUCLEI.length];
}

/** A fresh tongue of distinct syllables from a lineage seed. */
export function makeTongue(lineageSeed: number): Tongue {
  const out: string[] = [];
  let salt = 1;
  while (out.length < TONGUE_SIZE && salt < 200) {
    const s = syllable(hash32(lineageSeed, salt, 0x7a11));
    salt++;
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

/** The parent's tongue with one syllable replaced, chosen by the child's key. */
export function driftTongue(parent: Tongue, key: number): Tongue {
  const out = parent.slice();
  const at = hash32(key, 1, 0xd1f7) % out.length;
  for (let salt = 2; salt < 40; salt++) {
    const s = syllable(hash32(key, salt, 0xd1f7));
    if (!out.includes(s)) {
      out[at] = s;
      break;
    }
  }
  return out;
}

function word(tongue: Tongue, h: number, syllables: number): string {
  const n = tongue.length;
  const used: number[] = [];
  let out = '';
  for (let i = 0; i < syllables; i++) {
    let idx = h % n;
    // No syllable twice in one word: "Mama", "Lolo" are out.
    while (used.includes(idx) && used.length < n) idx = (idx + 1) % n;
    used.push(idx);
    out += tongue[idx];
    h = Math.floor(h / n) + 1;
  }
  // A closing consonant must not echo a sound already in the word ("Shushush", "Mam").
  let coda = CODAS[h % CODAS.length];
  if (coda !== '') {
    for (const idx of used) if (tongue[idx].startsWith(coda)) coda = '';
  }
  return capitalise(out + coda);
}

/** A given name for a person, one or two syllables: "Kesh". */
export function personName(personId: number, tongue: Tongue): string {
  const h = hash32(personId, 0, 0x9e37);
  return word(tongue, h, 1 + (h >>> 28 & 1));
}

/** A name for a band, two syllables: "Varn". */
export function bandName(bandKey: number, tongue: Tongue): string {
  return word(tongue, hash32(bandKey, 0, 0xba4d), 2);
}

/** A root word for a place, from the tongue of whoever is naming it and a coarse map cell. */
export function placeRoot(cellKey: number, tongue: Tongue): string {
  return word(tongue, hash32(cellKey, 0, 0x91ace), 2);
}

/** "Kesh of the Varn". */
export function fullName(personId: number, bandKey: number, tongue: Tongue): string {
  return `${personName(personId, tongue)} of the ${bandName(bandKey, tongue)}`;
}

/** The facts an epithet can come from. Genes and habits are 0..255. */
export interface EpithetFacts {
  readonly strength: number;
  readonly cruelty: number;
  readonly charisma: number;
  readonly wisdom: number;
  readonly bravery: number;
  /** Times this person led followers out of a band to start their own (they leave; nobody is exiled). */
  readonly departures: number;
  /** Largest following held so far. */
  readonly peakFollowers: number;
  readonly ageYears: number;
  /** Battles reported for their band while they led it. */
  readonly battles?: number;
  /** True for someone who gathered a band around themselves from nothing. */
  readonly founder?: boolean;
}

/**
 * An English epithet from traits or deeds, or null when nothing stands out.
 * Everything that applies goes in a pool and the id's hash picks one, so the
 * same person keeps the same epithet while different people vary.
 */
export function epithet(personId: number, f: EpithetFacts): string | null {
  const options: string[] = [];
  if (f.departures >= 3) options.push('the Wanderer');
  else if (f.departures === 2) options.push('the Restless');
  else if (f.departures === 1) options.push('the Leaver');
  if (f.founder) options.push('the Founder');
  if ((f.battles ?? 0) >= 3) options.push('Battle-Hardened');
  else if ((f.battles ?? 0) >= 1) options.push('the Warlike');
  if (f.cruelty > 190) options.push('the Cruel');
  if (f.cruelty < 50) options.push('the Gentle');
  if (f.strength > 200) options.push('the Strong');
  if (f.strength < 50) options.push('the Slight');
  if (f.charisma > 200) options.push('the Beloved');
  if (f.wisdom > 200) options.push('the Wise');
  if (f.bravery > 200) options.push('the Bold');
  if (f.bravery < 50) options.push('the Wary');
  if (f.peakFollowers >= 150) options.push('the Great');
  else if (f.peakFollowers >= 60) options.push('Many-Followed');
  if (f.ageYears >= 50) options.push('the Old');
  else if (f.ageYears < 24 && f.peakFollowers >= 20) options.push('the Young');
  if (options.length === 0) return null;
  return options[hash32(personId, 0, 0xe9171) % options.length];
}

export type Landform = 'Ridge' | 'Hill' | 'Plain' | 'Marsh' | 'Shore' | 'Valley' | 'Wood' | 'Steppe';

/** What the land looks like at a place. Inputs are 0..1 except the flags. */
export interface LandformFacts {
  readonly upland: number;
  readonly roughness: number;
  readonly cover: number;
  readonly nearWater: boolean;
}

export function landformFor(f: LandformFacts): Landform {
  if (f.upland > 0.5) return f.roughness > 0.5 ? 'Ridge' : 'Hill';
  if (f.nearWater) return f.cover > 0.5 ? 'Marsh' : 'Shore';
  if (f.cover > 0.65) return 'Wood';
  if (f.upland > 0.2) return 'Valley';
  return f.cover < 0.3 ? 'Steppe' : 'Plain';
}

/** "Varn Ridge": the band's root word plus an English landform. */
export function placeName(root: string, landform: Landform): string {
  return `${root} ${landform}`;
}
