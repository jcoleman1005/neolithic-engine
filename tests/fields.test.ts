import { describe, expect, it } from 'vitest';
import { ScentFields, FIELD_SIZE } from '../src/sim/fields';
import { DEFAULT_CONFIG } from '../src/sim/config';

describe('Phase 3 Scent Fields', () => {
  it('deposits scent and clamps within [0, 255]', () => {
    const fields = new ScentFields();
    expect(fields.getFood(10, 20)).toBe(0);
    expect(fields.getDanger(10, 20)).toBe(0);

    fields.depositFood(10, 20, 50);
    expect(fields.getFood(10, 20)).toBe(50);

    fields.depositFood(10, 20, 300);
    expect(fields.getFood(10, 20)).toBe(255);

    fields.depositDanger(10, 20, 40);
    expect(fields.getDanger(10, 20)).toBe(40);
  });

  it('diffuses scent symmetrically across wrapped torus edges', () => {
    const fields = new ScentFields();
    // Deposit at top-left corner (0, 0)
    fields.depositFood(0, 0, 100);

    const cfg = {
      ...DEFAULT_CONFIG,
      scentDiffusionRate: 0.1,
      scentEvaporationRate: 0.0, // test pure diffusion
    };

    fields.step(cfg);

    // Center cell should retain 1 - 4 * 0.1 = 0.6
    expect(fields.getFood(0, 0)).toBeCloseTo(60, 1);

    // All 4 wrapped neighbors should receive 0.1 * 100 = 10
    // East (1, 0), West (255, 0), South (0, 1), North (0, 255)
    expect(fields.getFood(1, 0)).toBeCloseTo(10, 1);
    expect(fields.getFood(255, 0)).toBeCloseTo(10, 1);
    expect(fields.getFood(0, 1)).toBeCloseTo(10, 1);
    expect(fields.getFood(0, 255)).toBeCloseTo(10, 1);

    // Diagonal cell should still be zero after 1 step
    expect(fields.getFood(1, 1)).toBe(0);
  });

  it('computes wrap-aware scent gradients', () => {
    const fields = new ScentFields();
    // High food at (0, 0)
    fields.depositFood(0, 0, 20);
    const grad = new Float32Array(2);

    // Gradient at (255, 0): east is (0, 0) which has 20, west is (254, 0) which has 0
    fields.getFoodGradient(255, 0, grad);
    expect(grad[0]).toBe(20);
    expect(grad[1]).toBe(0);

    // Gradient at (1, 0): east is (2, 0) [0], west is (0, 0) [20] -> dx = -20
    fields.getFoodGradient(1, 0, grad);
    expect(grad[0]).toBe(-20);
    expect(grad[1]).toBe(0);
  });

  it('preserves scent state across export and import round trip', () => {
    const fields = new ScentFields();
    fields.depositFood(50, 60, 42.5);
    fields.depositDanger(200, 210, 88.2);

    const exported = fields.exportState();
    const restored = new ScentFields();
    restored.importState(exported);

    expect(restored.getFood(50, 60)).toBeCloseTo(42.5, 4);
    expect(restored.getDanger(200, 210)).toBeCloseTo(88.2, 4);
    expect(restored.getFood(0, 0)).toBe(0);
  });
});
