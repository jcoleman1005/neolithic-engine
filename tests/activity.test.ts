import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { slotFromId } from '../src/sim/people';
import { PERSON_FRAME_BYTES } from '../src/sim/protocol';
import { fastBase64Decode, fastBase64Encode } from '../src/sim/base64';
import {
  act, ACT_DRINK, ACT_FIGHT, ACT_GRAZE, ACT_IDLE, ACT_MASK, ACT_WALK, ACTIVITY_NAMES, EV_BIRTH, EV_KILL, EV_MASK, mergePersonEvents,
} from '../src/sim/activity';

function quietWorld(config: Record<string, number | boolean> = {}): World {
  return new World({ initialPopulation: 0, wolfInitialCount: 0, herdInitialCount: 0, ...config }, 8);
}

function shoreTile(w: World): number {
  for (let c = 0; c < 65536; c++) if (w.land.isWater[c] === 0 && w.land.waterDist[c] === 1) return c;
  throw new Error('no shore');
}

function person(w: World, c: number, energy = 80): number {
  return slotFromId(w.people.spawn(c & 255, c >> 8, energy, 0, 0, 0, 0, new Uint8Array(8), new Uint8Array(8), 0));
}

/** The activity byte packed for `slot`, or -1. */
function packedActivity(w: World, slot: number): number {
  const buf = fastBase64Decode(w.packPeopleFrame().base64);
  for (let o = 0; o < buf.length; o += PERSON_FRAME_BYTES) {
    if ((buf[o] | (buf[o + 1] << 8)) === slot) return buf[o + PERSON_FRAME_BYTES - 1];
  }
  return -1;
}

describe('Watchability #3a: activity byte', () => {
  it('a higher code wins the tick and events are kept', () => {
    const a = new Uint8Array(1);
    act(a, 0, ACT_WALK);
    act(a, 0, ACT_GRAZE);
    expect(a[0]).toBe(ACT_WALK);
    a[0] |= EV_KILL;
    act(a, 0, ACT_FIGHT);
    expect(a[0] & ACT_MASK).toBe(ACT_FIGHT);
    expect(a[0] & EV_MASK).toBe(EV_KILL);
    expect(ACTIVITY_NAMES[ACT_FIGHT]).toBe('fighting');
  });

  it('a thirsty person on the shore is drinking, and a watered one is not', () => {
    const w = quietWorld();
    const s = person(w, shoreTile(w));
    w.people.hydration[s] = 80; // one drink (drinkRate 25) fills them
    w.step();
    expect(w.people.activity[s] & ACT_MASK).toBe(ACT_DRINK);
    w.step();
    expect(w.people.activity[s] & ACT_MASK).not.toBe(ACT_DRINK);
  });

  it('the frame carries the byte; events go out once, the action stays', () => {
    const w = quietWorld();
    const s = person(w, shoreTile(w));
    w.people.activity[s] = ACT_GRAZE | EV_BIRTH;
    expect(packedActivity(w, s)).toBe(ACT_GRAZE | EV_BIRTH);
    expect(packedActivity(w, s)).toBe(ACT_GRAZE);
  });

  it('a new tick starts idle but keeps unsent events', () => {
    const w = quietWorld();
    const s = person(w, shoreTile(w), 100);
    w.people.activity[s] = ACT_FIGHT | EV_KILL;
    w.step();
    expect(w.people.activity[s] & ACT_MASK).not.toBe(ACT_FIGHT);
    expect(w.people.activity[s] & EV_MASK).toBe(EV_KILL);
  });

  it('switched off, every byte stays 0', () => {
    const w = new World({ initialPopulation: 60, activityViewEnabled: false }, 5);
    for (let t = 0; t < 120; t++) w.step();
    let any = 0;
    for (let i = 0; i < w.people.capacity; i++) any |= w.people.activity[i];
    expect(any).toBe(ACT_IDLE);
  });

  it('is not saved and changes no outcome', () => {
    const on = new World({ initialPopulation: 60 }, 5);
    const off = new World({ initialPopulation: 60, activityViewEnabled: false }, 5);
    for (let t = 0; t < 300; t++) { on.step(); off.step(); }
    let any = 0;
    for (let i = 0; i < on.people.capacity; i++) any |= on.people.activity[i];
    expect(any).not.toBe(0);
    expect(on.stateHash()).toBe(off.stateHash());
    expect(JSON.stringify(on.exportState().people)).not.toContain('activity');
  });
});

describe('Watchability #3a: merged frames for slow viewers', () => {
  it('carries unsent events from the older frame to the same person only', () => {
    const rec = (slot: number, gen: number, act: number): number[] => {
      const r = new Array(PERSON_FRAME_BYTES).fill(0);
      r[0] = slot & 255; r[1] = slot >> 8; r[5] = gen; r[PERSON_FRAME_BYTES - 1] = act;
      return r;
    };
    const enc = (rows: number[][]): string => fastBase64Encode(Uint8Array.from(rows.flat()));
    const older = enc([rec(300, 1, ACT_GRAZE | EV_KILL), rec(7, 2, ACT_WALK | EV_BIRTH)]);
    const newer = enc([rec(300, 1, ACT_WALK), rec(7, 3, ACT_GRAZE)]); // slot 7 is someone new now
    const out = fastBase64Decode(mergePersonEvents(older, newer, PERSON_FRAME_BYTES));
    expect(out[PERSON_FRAME_BYTES - 1]).toBe(ACT_WALK | EV_KILL);
    expect(out[2 * PERSON_FRAME_BYTES - 1]).toBe(ACT_GRAZE);
    // Nothing to carry: the newer frame is returned as it is, and no scratch is left behind.
    const quiet = enc([rec(300, 1, ACT_GRAZE)]);
    expect(mergePersonEvents(quiet, newer, PERSON_FRAME_BYTES)).toBe(newer);
    expect(fastBase64Decode(mergePersonEvents(older, newer, PERSON_FRAME_BYTES))[PERSON_FRAME_BYTES - 1]).toBe(ACT_WALK | EV_KILL);
  });
});
