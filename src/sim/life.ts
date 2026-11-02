import type { SimulationConfig } from './types';
import { seasonGrowthFactor } from './seasons';
import {
  type People,
  GENE_COUNT,
  HABIT_COUNT,
  slotFromId,
} from './people';
import type { Land } from './land';
import type { SpatialIndex } from './spatial';
import type { ScentFields } from './fields';
import type { EnergyLedger } from './ledger';
import type { PRNG } from './prng';
import { Rules } from './rules';

// Preallocated scratch arrays for zero allocations in hot loops
const scratchChildGenes = new Uint8Array(GENE_COUNT);
const scratchChildHabits = new Uint8Array(HABIT_COUNT);

export class LifeSystem {
  /**
   * Advances one full daily simulation tick.
   * Allocates zero objects or closures per person.
   */
  public static step(
    people: People,
    land: Land,
    fields: ScentFields,
    spatial: SpatialIndex,
    ledger: EnergyLedger,
    config: Readonly<SimulationConfig>,
    prng: PRNG,
    tick: number
  ): void {
    // 1. Land food regrowth
    land.step(config, seasonGrowthFactor(tick, config));

    // 2. Scent fields: deposit land food scent & diffuse periodically
    const diffInterval = config.scentDiffusionInterval ?? 4;
    if (tick % diffInterval === 0) {
      const emitRate = config.scentFoodEmitRate ?? 0.1;
      const foodArr = land.food;
      const isWater = land.isWater;
      const foodCurr = fields.foodCurrent;
      for (let i = 0; i < 65536; i++) {
        if (isWater[i] === 0 && foodArr[i] > 1.0) {
          foodCurr[i] = Math.min(255, foodCurr[i] + foodArr[i] * emitRate);
        }
      }
      fields.step(config);
    }

    const cap = people.capacity;
    const alive = people.alive;
    const px = people.x;
    const py = people.y;
    const energy = people.energy;
    const age = people.age;
    const sex = people.sex;
    const pregnant = people.pregnant;
    const mateId = people.mateId;
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
    const dangerDeath = config.scentDangerDeath ?? 10.0;

    // 3. Clear stale leader links & evaluate Metabolism & Mortality
    for (let slot = 0; slot < cap; slot++) {
      if (alive[slot] === 0) continue;

      people.clearStaleLeader(slot);

      age[slot]++;
      energy[slot] -= metabolism;
      ledger.upkeep += metabolism;

      // Starvation death
      if (energy[slot] <= 0) {
        if (energy[slot] < 0) {
          ledger.overdraft += -energy[slot];
        }
        fields.depositDanger(px[slot], py[slot], dangerDeath);
        people.kill(slot);
        continue;
      }

      // Old age death
      if (age[slot] >= maxAge) {
        ledger.deathFat += energy[slot];
        fields.depositDanger(px[slot], py[slot], dangerDeath);
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

    // 5. Movement (Climb rule or Wander fallback)
    const climbOn = config.climbEnabled ?? true;
    for (let slot = 0; slot < cap; slot++) {
      if (alive[slot] === 0) continue;

      let dir = 4; // Stay
      if (climbOn) {
        dir = Rules.climb(slot, people, land, fields, config, prng);
      } else {
        dir = prng.nextInt(0, 5);
      }

      people.prevDir[slot] = dir;
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
            fields.depositDanger(nx, ny, dangerDeath);
            people.kill(slot);
            continue;
          }
        }
      }
    }

    // 6. Spatial indexing based on updated positions
    spatial.build(people);

    // Refresh a slice of the root leader cache each tick
    const rootSlices = config.rootLeaderSliceCount ?? 8;
    people.refreshRootLeadersSlice(tick % rootSlices, rootSlices);

    // 7. Mating Search (zero closures/allocations)
    const cellStarts = spatial.cellStarts;
    const cellPeople = spatial.cellPeople;
    const rSq = matingRadius * matingRadius;

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

        searchMate:
        for (let dy = -matingRadius; dy <= matingRadius; dy++) {
          const y = (femaleY + dy) & 255;
          const row = y << 8;
          for (let dx = -matingRadius; dx <= matingRadius; dx++) {
            if (dx * dx + dy * dy > rSq) continue;
            const x = (femaleX + dx) & 255;
            const cell = row | x;
            const start = cellStarts[cell];
            const end = cellStarts[cell + 1];
            for (let idx = start; idx < end; idx++) {
              const otherSlot = cellPeople[idx];
              if (otherSlot === slot || alive[otherSlot] === 0) continue;
              if (sex[otherSlot] !== 1) continue; // Males only
              if (age[otherSlot] < adultAge || energy[otherSlot] < reproThreshold) continue;

              const maleId = people.idOf(otherSlot);
              const maleMom = motherId[otherSlot];
              const maleDad = fatherId[otherSlot];

              // Kin avoidance: parent-child or full/half siblings
              if (maleId === femaleDad) continue;
              if (maleMom === femaleId) continue;
              if (femaleMom > 0 && femaleMom === maleMom) continue;
              if (femaleDad > 0 && femaleDad === maleDad) continue;

              foundMateSlot = otherSlot;
              break searchMate;
            }
          }
        }

        if (foundMateSlot !== -1) {
          pregnant[slot] = 0;
          mateId[slot] = people.idOf(foundMateSlot);
        }
      }
    }

    // 8. Social Decision / Copy rule (staggered by ID)
    if (config.copyEnabled ?? true) {
      const stagger = config.decisionStaggerInterval ?? 8;
      for (let slot = 0; slot < cap; slot++) {
        if (alive[slot] === 1 && (tick + slot) % stagger === 0) {
          Rules.copy(slot, people, spatial, config, prng);
        }
      }
    }

    // 8b. Hunger and plenty shape habits (no random draws)
    if (config.experienceHabitsEnabled ?? true) {
      const stagger = config.decisionStaggerInterval ?? 8;
      for (let slot = 0; slot < cap; slot++) {
        if (alive[slot] === 1 && (tick + slot) % stagger === 0) {
          Rules.experienceNeeds(slot, people, config);
        }
      }
    }

    // 9. Physical Contact / Touch rule (co-located people)
    if (config.touchEnabled ?? true) {
      const cellStarts = spatial.cellStarts;
      const cellPeople = spatial.cellPeople;
      for (let c = 0; c < 65536; c++) {
        const start = cellStarts[c];
        const count = cellStarts[c + 1] - start;
        if (count >= 2) {
          Rules.touchCell(
            start,
            count,
            cellPeople,
            people,
            land,
            fields,
            spatial,
            ledger,
            config,
            prng,
            tick
          );
        }
      }
    }

    // 9. Gestation, Childbirth & Genetic/Habit Inheritance
    const mutRate = config.geneMutationRate ?? 0.05;
    const mutRange = config.geneMutationRange ?? 16;
    const innovRate = config.habitInnovationRate ?? 0.01;
    const innovRange = config.habitInnovationRange ?? 40;

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
            const fId = mateId[slot];

            // Genetic inheritance: blend parents + mutation
            const momGOff = slot * GENE_COUNT;
            const dadSlot = slotFromId(fId);
            const dadLiving = people.isValidId(fId);
            const dadGOff = dadLiving ? dadSlot * GENE_COUNT : momGOff;

            for (let g = 0; g < GENE_COUNT; g++) {
              let allele = prng.next() < 0.5 ? people.genes[momGOff + g] : people.genes[dadGOff + g];
              if (prng.next() < mutRate) {
                const mut = prng.nextInt(-mutRange, mutRange);
                allele = Math.max(0, Math.min(255, allele + mut));
              }
              scratchChildGenes[g] = allele;
            }

            // Habit transmission: each habit comes from one parent at random (like genes),
            // plus small drift, and rarely one bigger innovation.
            const momHOff = slot * HABIT_COUNT;
            const dadHOff = dadLiving ? dadSlot * HABIT_COUNT : momHOff;

            for (let h = 0; h < HABIT_COUNT; h++) {
              const inherited = prng.next() < 0.5 ? people.habits[momHOff + h] : people.habits[dadHOff + h];
              const drift = prng.nextInt(-4, 4);
              scratchChildHabits[h] = Math.max(0, Math.min(255, inherited + drift));
            }
            if (prng.next() < innovRate) {
              const h = prng.nextInt(0, HABIT_COUNT - 1);
              const jump = prng.nextInt(-innovRange, innovRange);
              scratchChildHabits[h] = Math.max(0, Math.min(255, scratchChildHabits[h] + jump));
            }

            people.spawn(
              childX,
              childY,
              childEnergy,
              childSex,
              childGen,
              mId,
              fId,
              scratchChildGenes,
              scratchChildHabits,
              people.leaderId[slot]
            );
          }
          mateId[slot] = 0;
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

        // Generate diverse founder genes & habits
        for (let g = 0; g < GENE_COUNT; g++) {
          scratchChildGenes[g] = prng.nextInt(32, 224);
        }
        for (let h = 0; h < HABIT_COUNT; h++) {
          scratchChildHabits[h] = prng.nextInt(64, 192);
        }

        const slot = people.spawn(
          x,
          y,
          initialEnergy,
          sex,
          0,
          0,
          0,
          scratchChildGenes,
          scratchChildHabits,
          0
        );
        const actualSlot = slot >>> 12;
        people.age[actualSlot] = founderAge;
        ledger.immigrants += initialEnergy;
        seeded++;
      }
    }
  }
}
