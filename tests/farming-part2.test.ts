import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Land } from '../src/sim/land';
import { DEFAULT_CONFIG } from '../src/sim/config';
import { GENE_COUNT, GENE_STRENGTH } from '../src/sim/people';

const cfg = { ...DEFAULT_CONFIG, elevationEnabled: false, terrainEnabled: false };
const cell = (x: number, y: number) => (y << 8) | x;

// Split from farming.test.ts: vitest's worker RPC times out when one file runs longer than 60 s under load.
describe('Phase 5b farming physics (part 2)', () => {
  it('farming state survives a save round trip and the run continues identically', async () => {
    const a = new World({ initialPopulation: 120 }, 9);
    for (let t = 0; t < 200; t++) {
      a.step();
      if (t % 50 === 0) await new Promise((r) => setImmediate(r));
    }
    const b = World.fromState(JSON.parse(JSON.stringify(a.exportState())));
    expect(b.stateHash()).toBe(a.stateHash());
    for (let t = 0; t < 50; t++) {
      a.step();
      b.step();
      if (t % 50 === 0) await new Promise((r) => setImmediate(r));
    }
    expect(b.stateHash()).toBe(a.stateHash());
  });

  it('with farming physics off, no land arrays change and carry stays zero', async () => {
    const w = new World({ initialPopulation: 120, farmingPhysicsEnabled: false, stockpilesEnabled: false }, 4);
    for (let t = 0; t < 300; t++) {
      w.step();
      if (t % 50 === 0) await new Promise((r) => setImmediate(r));
    }
    expect(w.land.tilled.every((v) => v === 0)).toBe(true);
    expect(w.land.seeds.every((v) => v === 0)).toBe(true);
    expect(w.land.soilHealth.every((v) => v === 1)).toBe(true);
    expect(w.people.carry.every((v) => v === 0)).toBe(true);
  });

  it('values stay in range and energy still balances with farming physics on', async () => {
    const w = new World({ initialPopulation: 200 }, 5);
    for (let t = 0; t < 250; t++) {
      w.step();
      if (t % 50 === 0) await new Promise((r) => setImmediate(r));
    }
    for (let i = 0; i < 65536; i++) {
      expect(w.land.tilled[i]).toBeGreaterThanOrEqual(0);
      expect(w.land.tilled[i]).toBeLessThanOrEqual(1.0001);
      expect(w.land.seeds[i]).toBeLessThanOrEqual(cfg.seedCap + 1e-4);
      expect(w.land.soilHealth[i]).toBeGreaterThanOrEqual(cfg.soilMin - 1e-6);
    }
    for (let s = 0; s < w.people.capacity; s++) {
      const kind = w.people.carryKind[s];
      // Food, brush, and stone limits scale with the person's strength gene; seeds are picked up to seedCarryMax or looted up to seedCarryMax * body.
      const body = 1 + (cfg.strengthCarry ?? 0.6) * (w.people.genes[s * GENE_COUNT + GENE_STRENGTH] / 255 - 0.5);
      const limit = kind === 2 ? cfg.foodCarryMax * body
        : kind === 3 ? cfg.brushCarryMax * body
        : kind === 4 ? (cfg.stoneCarryMax ?? 8.0) * body
        : cfg.seedCarryMax * Math.max(1, body);
      expect(w.people.carry[s]).toBeLessThanOrEqual(limit + 1e-4);
    }
    expect(w.ledger.violations).toBe(0);
  });

  it('the overlay packs desert, farmland and seed levels into one byte per cell', () => {
    const land = new Land(cfg);
    const i = cell(7, 7);
    land.tilled[i] = 1; land.seeds[i] = cfg.seedCap; land.soilHealth[i] = cfg.soilMin;
    const out = new Uint8Array(65536);
    land.packOverlay(out, cfg);
    expect(out[i] & 7).toBe(7);
    expect((out[i] >> 3) & 7).toBe(7);
    expect(out[i] >> 6).toBe(3);
    expect(out[cell(8, 8)]).toBe(0);
  });
});
