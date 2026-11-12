/**
 * Watchability #3a: what each person is doing, for the viewer only.
 *
 * One byte per person (`People.activity`). It is an observer: not saved, not hashed, no random
 * draws, and nothing in the simulation reads it, so it changes no outcome (AGENTS rule 11).
 *
 * - Low 4 bits: the main action this tick. Each tick starts at ACT_IDLE and every action site
 *   offers its code; a higher code wins, so the codes are also the precedence (a step beats a bite,
 *   a fight beats a step).
 * - High 4 bits: one-tick events, OR-ed in and kept until the next people frame is packed
 *   (`World.packPeopleFrame` clears them), so a kill between two frames is not lost.
 */

import { fastBase64Decode, fastBase64Encode } from './base64';

export const ACT_IDLE = 0;
/** Standing still in shelter (cave, hut, nest or a fire's warmth). */
export const ACT_REST = 1;
/** Tamping a food or brush heap underfoot (idle, well-fed labour). */
export const ACT_TEND = 2;
/** Eating plants or berries where they grow. */
export const ACT_GRAZE = 3;
/** Picking up something to carry: surplus food, brush, stone, earth or water. */
export const ACT_GATHER = 4;
/** Eating from a heap or from what they carry (meat after a kill, stores). */
export const ACT_EAT = 5;
export const ACT_FISH = 6;
/** A mother staying beside her young child. */
export const ACT_NURSE = 7;
export const ACT_DRINK = 8;
/** Setting stone or earth down on a wall. */
export const ACT_BUILD = 9;
export const ACT_WALK = 10;
/** Stepping while afraid (inside the region where they were beaten). */
export const ACT_FLEE = 11;
/** Striking at an animal beside them. */
export const ACT_HUNT = 12;
/** Gave way or conceded food in a contest. */
export const ACT_YIELD = 13;
export const ACT_FIGHT = 14;

export const ACT_MASK = 0x0f;

/** Events (high bits), kept until the next frame. */
export const EV_KILL = 0x10;
export const EV_BIRTH = 0x20;
export const EV_FIRE = 0x40;
/** A tile they built on became a hut this tick. */
export const EV_BUILT = 0x80;
export const EV_MASK = 0xf0;

/** Children this young count as nursed when their mother stays beside them (ticks; 360 a year). */
export const NURSE_AGE = 720;

/** Offers `code` as this tick's action; the higher code wins. */
export function act(activity: Uint8Array, slot: number, code: number): void {
  const a = activity[slot];
  if (code > (a & ACT_MASK)) activity[slot] = (a & EV_MASK) | code;
}

/** Plain names, for tests, the legend and the inspector. */
export const ACTIVITY_NAMES: readonly string[] = [
  'idle', 'resting', 'tending a heap', 'grazing', 'gathering', 'eating', 'fishing', 'nursing', 'drinking',
  'building', 'walking', 'fleeing', 'hunting', 'giving way', 'fighting',
];

// Scratch for mergePersonEvents: events and slot generation by slot (slots are 16-bit in the frame).
const mergeEvents = new Uint8Array(65536);
const mergeGens = new Uint8Array(65536);

/**
 * Two people frames (base64, `frameBytes` per person) merged for a slow viewer: the newer frame wins,
 * but events still unsent in the older one are OR-ed in for the same person (same slot and generation),
 * so a kill or birth in a frame the server folded away still shows. Returns `newer` when the older frame
 * holds no events.
 */
export function mergePersonEvents(older: string, newer: string, frameBytes: number): string {
  const a = fastBase64Decode(older);
  const last = frameBytes - 1;
  let found = false;
  for (let o = 0; o + last < a.length; o += frameBytes) {
    const ev = a[o + last] & EV_MASK;
    if (ev === 0) continue;
    const slot = a[o] | (a[o + 1] << 8);
    mergeEvents[slot] |= ev;
    mergeGens[slot] = a[o + 5];
    found = true;
  }
  if (!found) return newer;
  const b = fastBase64Decode(newer);
  for (let o = 0; o + last < b.length; o += frameBytes) {
    const slot = b[o] | (b[o + 1] << 8);
    if (mergeEvents[slot] !== 0 && mergeGens[slot] === b[o + 5]) b[o + last] |= mergeEvents[slot];
  }
  // Clear only what was set.
  for (let o = 0; o + last < a.length; o += frameBytes) mergeEvents[a[o] | (a[o + 1] << 8)] = 0;
  return fastBase64Encode(b);
}
