import { describe, expect, it } from 'vitest';
import { fastBase64Decode, fastBase64Encode } from '../src/sim/base64';
import {
  PERSON_FRAME_BYTES,
  LOOK_STAGE_CHILD,
  LOOK_STAGE_ADULT,
  LOOK_STAGE_ELDER,
  encodeLookByte,
  decodeLookByte,
} from '../src/sim/protocol';
import { World } from '../src/sim/world';
import { SimulationHost, type HostEnvironment } from '../src/sim/host';
import type { FromWorker } from '../src/sim/protocol';

describe('Base64 Encoding and Decoding', () => {
  it('roundtrips empty, unaligned, and random byte arrays', () => {
    const empty = new Uint8Array(0);
    expect(fastBase64Decode(fastBase64Encode(empty))).toEqual(empty);

    const sizes = [1, 2, 3, 4, 5, 17, 100, 1024];
    for (const size of sizes) {
      const original = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        original[i] = (i * 37 + 13) & 0xff;
      }
      const b64 = fastBase64Encode(original);
      const decoded = fastBase64Decode(b64);
      expect(decoded).toEqual(original);
    }
  });
});

describe('Look Byte Encoding & Decoding', () => {
  it('encodes and decodes sex, pregnancy, stage, and energy level accurately', () => {
    // Female, pregnant, adult, 80 energy
    const l1 = encodeLookByte(0, true, LOOK_STAGE_ADULT, 80, 100);
    const d1 = decodeLookByte(l1);
    expect(d1.sex).toBe('female');
    expect(d1.pregnant).toBe(true);
    expect(d1.stage).toBe('adult');
    expect(d1.energyLevel).toBe(Math.floor((80 / 100) * 15));

    // Male, not pregnant, child, 10 energy (low)
    const l2 = encodeLookByte(1, false, LOOK_STAGE_CHILD, 10, 100);
    const d2 = decodeLookByte(l2);
    expect(d2.sex).toBe('male');
    expect(d2.pregnant).toBe(false);
    expect(d2.stage).toBe('child');
    expect(d2.energyLevel).toBe(Math.floor((10 / 100) * 15));

    // Elder, 0 energy
    const l3 = encodeLookByte(0, false, LOOK_STAGE_ELDER, 0, 100);
    const d3 = decodeLookByte(l3);
    expect(d3.stage).toBe('elder');
    expect(d3.energyLevel).toBe(0);
  });
});

describe('Phase 2 Frame Packing and Person Details', () => {
  it('packs alive people into compact 5-byte records', () => {
    const world = new World({ seed: 42, initialPopulation: 50 });
    const { base64, count } = world.packPeopleFrame();
    expect(count).toBe(world.people.count);

    const decoded = fastBase64Decode(base64);
    expect(decoded.length).toBe(count * PERSON_FRAME_BYTES);

    // Verify first person
    const slot0 = decoded[0] | (decoded[1] << 8);
    const x0 = decoded[2];
    const y0 = decoded[3];
    const look0 = decoded[4];

    expect(world.people.alive[slot0]).toBe(1);
    expect(world.people.x[slot0]).toBe(x0);
    expect(world.people.y[slot0]).toBe(y0);
    expect(look0).toBeGreaterThanOrEqual(0);
  });

  it('retrieves detailed person record by slot or 32-bit ID', () => {
    const world = new World({ seed: 123, initialPopulation: 30 });
    // Find first alive slot
    let aliveSlot = -1;
    for (let s = 0; s < world.people.capacity; s++) {
      if (world.people.alive[s] === 1) {
        aliveSlot = s;
        break;
      }
    }
    expect(aliveSlot).toBeGreaterThanOrEqual(0);

    const recordBySlot = world.getPersonRecord(aliveSlot);
    expect(recordBySlot).not.toBeNull();
    expect(recordBySlot!.slot).toBe(aliveSlot);
    expect(recordBySlot!.x).toBe(world.people.x[aliveSlot]);
    expect(recordBySlot!.y).toBe(world.people.y[aliveSlot]);
    expect(recordBySlot!.energy).toBeCloseTo(world.people.energy[aliveSlot], 1);

    const fullId = recordBySlot!.id;
    const recordById = world.getPersonRecord(fullId);
    expect(recordById).toEqual(recordBySlot);

    // Invalid or dead slot returns null
    expect(world.getPersonRecord(999999)).toBeNull();
  });

  it('calculates shortest wrapping delta correctly across borders', () => {
    const W = 256;
    const wrapDelta = (from: number, to: number) => {
      let d = to - from;
      if (d > W / 2) d -= W;
      else if (d < -W / 2) d += W;
      return d;
    };

    expect(wrapDelta(255, 0)).toBe(1);
    expect(wrapDelta(0, 255)).toBe(-1);
    expect(wrapDelta(254, 1)).toBe(3);
    expect(wrapDelta(1, 254)).toBe(-3);
    expect(wrapDelta(100, 102)).toBe(2);
    expect(wrapDelta(102, 100)).toBe(-2);
  });

  it('host delivers selected person details to viewer', () => {
    const posted: FromWorker[] = [];
    const env: HostEnvironment = {
      post: (m) => posted.push(m),
      now: () => 1000,
      schedule: () => 1,
      cancel: () => {},
    };

    const host = new SimulationHost(env, { seed: 42, initialPopulation: 20 });
    // Find first alive slot
    let aliveSlot = -1;
    for (let s = 0; s < host.world.people.capacity; s++) {
      if (host.world.people.alive[s] === 1) {
        aliveSlot = s;
        break;
      }
    }

    posted.length = 0;
    host.handle({ kind: 'select', id: aliveSlot });

    const frameWithPerson = posted.find(
      (m): m is Extract<FromWorker, { kind: 'frame' }> => m.kind === 'frame'
    );
    expect(frameWithPerson).toBeDefined();
    expect(frameWithPerson!.panels?.selectedPerson).toBeDefined();
    expect(frameWithPerson!.panels?.selectedPerson?.slot).toBe(aliveSlot);
  });
});
