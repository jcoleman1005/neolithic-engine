import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world';

describe('No water spawns or movement into water', () => {
  it('ensures founders, herds, and wolves never spawn or walk into water across multiple seeds', () => {
    for (const seed of [1, 42, 12345]) {
      const world = new World({}, seed);
      const land = world.land;

      // 1. Verify founder people
      for (let s = 0; s < world.people.capacity; s++) {
        if (world.people.alive[s] === 1) {
          const x = world.people.x[s];
          const y = world.people.y[s];
          const isWater = land.isWaterAt(x, y) || (land.elevation ? land.elevation.water[(y << 8) | x] > 0 : false);
          expect(isWater).toBe(false);
        }
      }

      // 2. Verify founder herds
      for (let s = 0; s < world.herds.capacity; s++) {
        if (world.herds.alive[s] === 1) {
          const x = world.herds.x[s];
          const y = world.herds.y[s];
          const isWater = land.isWater[(y << 8) | x] === 1 || (land.elevation ? land.elevation.water[(y << 8) | x] > 0 : false);
          expect(isWater).toBe(false);
        }
      }

      // 3. Verify founder wolves
      for (let s = 0; s < world.wolves.capacity; s++) {
        if (world.wolves.alive[s] === 1) {
          const x = world.wolves.x[s];
          const y = world.wolves.y[s];
          const isWater = land.isWater[(y << 8) | x] === 1 || (land.elevation ? land.elevation.water[(y << 8) | x] > 0 : false);
          expect(isWater).toBe(false);
        }
      }

      // 4. Step 50 ticks and verify no living entity is on water
      for (let t = 0; t < 50; t++) {
        world.step();
      }

      for (let s = 0; s < world.people.capacity; s++) {
        if (world.people.alive[s] === 1) {
          const x = world.people.x[s];
          const y = world.people.y[s];
          const isWater = land.isWaterAt(x, y) || (land.elevation ? land.elevation.water[(y << 8) | x] > 0 : false);
          expect(isWater).toBe(false);
        }
      }

      for (let s = 0; s < world.herds.capacity; s++) {
        if (world.herds.alive[s] === 1) {
          const x = world.herds.x[s];
          const y = world.herds.y[s];
          const isWater = land.isWater[(y << 8) | x] === 1 || (land.elevation ? land.elevation.water[(y << 8) | x] > 0 : false);
          expect(isWater).toBe(false);
        }
      }

      for (let s = 0; s < world.wolves.capacity; s++) {
        if (world.wolves.alive[s] === 1) {
          const x = world.wolves.x[s];
          const y = world.wolves.y[s];
          const isWater = land.isWater[(y << 8) | x] === 1 || (land.elevation ? land.elevation.water[(y << 8) | x] > 0 : false);
          expect(isWater).toBe(false);
        }
      }
    }
  });
});
