import type { SimulationConfig } from './types';
import type { People } from './people';
import type { Land } from './land';
import type { SpatialIndex } from './spatial';
import type { EnergyLedger } from './ledger';
import type { PRNG } from './prng';

export class LifeSystem {
  /**
   * Advances one full daily simulation tick.
   * Allocates zero objects or closures per person.
   */
  public static step(
    people: People,
    land: Land,
    spatial: SpatialIndex,
    ledger: EnergyLedger,
    config: Readonly<SimulationConfig>,
    prng: PRNG
  ): void {
    // 1. Spatial indexing
    spatial.build(people);

    // 2. Land food regrowth
    land.step(config);

    const cap = people.capacity;
    const alive = people.alive;
    const px = people.x;
    const py = people.y;
    const energy = people.energy;
    const age = people.age;
    const sex = people.sex;
    const pregnant = people.pregnant;
    const mateSlot = people.mateSlot;
    const motherId = people.motherId;
    const fatherId = people.fatherId;
    const gen = people.generation;

    const metabolism = config.metabolismCost ?? 0.25;
    const maxAge = config.maxAge ?? 21600;
    const maxEnergy = config.maxEnergy ?? 100.0;
    const forageBite = config.forageBite ?? 1.0;
    const moveCost = config.moveCost ?? 0.05;
    const adultAge = config.adultAge ?? 5760;
    const reproThreshold = config.reproductionThreshold ?? 65.0;
    const childEnergy = config.childEnergy ?? 30.0;
    const birthTax = config.birthTax ?? 5.0;
    const totalBirthCost = childEnergy + birthTax;
    const gestationTicks = config.gestationTicks ?? 270;
    const matingRadius = config.matingRadius ?? 2;

    // 3. Metabolism & Mortality
    for (let slot = 0; slot < cap; slot++) {
      if (alive[slot] === 0) continue;

      age[slot]++;
      energy[slot] -= metabolism;
      ledger.upkeep += metabolism;

      // Starvation death
      if (energy[slot] <= 0) {
        if (energy[slot] < 0) {
          ledger.overdraft += -energy[slot];
        }
        people.kill(slot);
        continue;
      }

      // Old age death
      if (age[slot] >= maxAge) {
        ledger.deathFat += energy[slot];
        people.kill(slot);
        continue;
      }
    }

    // 4. Foraging
    for (let slot = 0; slot < cap; slot++) {
      if (alive[slot] === 0) continue;

      const curE = energy[slot];
      if (curE < maxEnergy) {
        const want = Math.min(forageBite, maxEnergy - curE);
        const eaten = land.graze(px[slot], py[slot], want, config);
        if (eaten > 0) {
          energy[slot] = curE + eaten;
          ledger.plantMeal += eaten;
        }
      }
    }

    // 5. Wandering & Movement
    for (let slot = 0; slot < cap; slot++) {
      if (alive[slot] === 0) continue;

      // 4 cardinal moves or stay: 0 = east, 1 = west, 2 = south, 3 = north, >= 4 stay
      const dir = prng.nextInt(0, 5);
      if (dir < 4) {
        let dx = 0;
        let dy = 0;
        if (dir === 0) dx = 1;
        else if (dir === 1) dx = -1;
        else if (dir === 2) dy = 1;
        else if (dir === 3) dy = -1;

        const nx = (px[slot] + dx) & 0xff;
        const ny = (py[slot] + dy) & 0xff;

        if (!land.isWaterAt(nx, ny)) {
          px[slot] = nx;
          py[slot] = ny;
          energy[slot] -= moveCost;
          ledger.move += moveCost;

          if (energy[slot] <= 0) {
            if (energy[slot] < 0) {
              ledger.overdraft += -energy[slot];
            }
            people.kill(slot);
            continue;
          }
        }
      }
    }

    // 6. Gestation & Birth
    for (let slot = 0; slot < cap; slot++) {
      if (alive[slot] === 0 || sex[slot] !== 0) continue; // Females only

      if (pregnant[slot] >= 0) {
        pregnant[slot]++;
        if (pregnant[slot] >= gestationTicks) {
          pregnant[slot] = -1;

          if (energy[slot] > totalBirthCost) {
            energy[slot] -= totalBirthCost;
            ledger.birthCosts += birthTax;

            // Place newborn in nearby non-water cell
            const offX = prng.nextInt(-1, 1);
            const offY = prng.nextInt(-1, 1);
            const bx = (px[slot] + offX) & 0xff;
            const by = (py[slot] + offY) & 0xff;
            const childX = land.isWaterAt(bx, by) ? px[slot] : bx;
            const childY = land.isWaterAt(bx, by) ? py[slot] : by;

            const childSex = prng.next() < 0.5 ? 0 : 1;
            const childGen = gen[slot] + 1;
            const mId = people.idOf(slot);
            const fId = fatherId[slot];

            people.spawn(childX, childY, childEnergy, childSex, childGen, mId, fId);
          }
          mateSlot[slot] = -1;
        }
      }
    }

    // 7. Mating Search
    for (let slot = 0; slot < cap; slot++) {
      if (alive[slot] === 0 || sex[slot] !== 0) continue; // Unmated females initiate
      if (pregnant[slot] !== -1) continue;

      if (age[slot] >= adultAge && energy[slot] >= reproThreshold) {
        const femaleX = px[slot];
        const femaleY = py[slot];
        const femaleId = people.idOf(slot);
        const femaleMom = motherId[slot];
        const femaleDad = fatherId[slot];

        let foundMateSlot = -1;

        spatial.query(femaleX, femaleY, matingRadius, (otherSlot) => {
          if (otherSlot === slot || alive[otherSlot] === 0) return;
          if (sex[otherSlot] !== 1) return; // Males only
          if (age[otherSlot] < adultAge || energy[otherSlot] < reproThreshold) return;

          const maleId = people.idOf(otherSlot);
          const maleMom = motherId[otherSlot];
          const maleDad = fatherId[otherSlot];

          // Kin avoidance: parent-child or full/half siblings
          if (maleId === femaleDad) return;
          if (maleMom === femaleId) return;
          if (femaleMom > 0 && femaleMom === maleMom) return;
          if (femaleDad > 0 && femaleDad === maleDad) return;

          foundMateSlot = otherSlot;
          return false; // Break spatial search
        });

        if (foundMateSlot !== -1) {
          pregnant[slot] = 0;
          mateSlot[slot] = foundMateSlot;
          fatherId[slot] = people.idOf(foundMateSlot);
        }
      }
    }
  }

  /**
   * Populates founders on land cells at the start of a run.
   */
  public static seedFounders(
    people: People,
    land: Land,
    ledger: EnergyLedger,
    config: Readonly<SimulationConfig>,
    prng: PRNG
  ): void {
    const pop = config.initialPopulation ?? 1000;
    const initialEnergy = config.initialEnergy ?? 50.0;
    const adultAge = config.adultAge ?? 5760;

    let seeded = 0;
    let attempts = 0;
    const maxAttempts = pop * 100;

    while (seeded < pop && attempts++ < maxAttempts) {
      const x = prng.nextInt(0, 255);
      const y = prng.nextInt(0, 255);
      if (!land.isWaterAt(x, y)) {
        const sex = prng.next() < 0.5 ? 0 : 1;
        // Start as young adults so mating begins reasonably soon
        const founderAge = adultAge + prng.nextInt(0, 1000);
        const slot = people.spawn(x, y, initialEnergy, sex, 0, 0, 0);
        const actualSlot = slot >>> 12;
        people.age[actualSlot] = founderAge;
        ledger.immigrants += initialEnergy;
        seeded++;
      }
    }
  }
}
