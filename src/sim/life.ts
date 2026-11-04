import type { SimulationConfig } from './types';
import { seasonGrowthFactor, yearPhase } from './seasons';
import { CARRY_NONE, CARRY_SEED, CARRY_FOOD, CARRY_BRUSH, CARRY_STONE } from './people';
import { stageWork, GENE_STRENGTH } from './people';
import { FORM_NEST } from './land';
import {
  type People,
  GENE_COUNT,
  HABIT_COUNT,
  slotFromId,
} from './people';
import type { Land } from './land';
import type { SpatialIndex } from './spatial';
import type { Herds } from './herds';
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
    tick: number,
    herds?: Herds
  ): void {
    // 1. Land food regrowth
    const coldOn = config.coldEnabled !== false;
    const firesOn = coldOn && config.firesEnabled !== false && config.nestsEnabled !== false;
    land.setSeason(
      coldOn && config.seasonsEnabled !== false
        ? (config.coldSeasonAmp ?? 1.0) * Math.sin(2 * Math.PI * (yearPhase(tick, config) - 0.125))
        : 0,
      config
    );
    land.refreshWarmth(config);
    land.step(config, seasonGrowthFactor(tick, config));
    if (firesOn) land.burnFires(config);
    if (config.buildingEnabled !== false) land.erode(tick, config);
    land.ageGraves();

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
    const nestsOn = config.nestsEnabled !== false;
    const nestUpkeep = config.nestUpkeep ?? 0.7;
    const hutUpkeepMul = config.hutUpkeep ?? 0.5;
    const coldUpkeep = config.coldUpkeep ?? 0.6;
    const injuryOn = config.injuryEnabled !== false;
    const injuryUpkeep = config.injuryUpkeep ?? 0.3;
    const injurySlow = config.injurySlow ?? 0.6;
    const healAbove = (config.injuryHealEnergy ?? 0.5) * (config.maxEnergy ?? 100);
    const injuryHeal = config.injuryHeal ?? 0.3;
    const graveTicks = config.graveTicks ?? 150;
    const stagesOn = config.stagesEnabled !== false;
    const childWork = config.childWork ?? 0.6;
    const elderWork = config.elderWork ?? 0.8;
    const strengthCarry = config.strengthCarry ?? 0.6;
    const careOn = config.childcareEnabled !== false;
    const childCare = config.childCare ?? 0.05;
    const careRadius = config.careRadius ?? 4;
    const fatigueOn = config.fatigueEnabled !== false;
    const fatigueMove = config.fatigueMove ?? 2;
    const fatigueRest = config.fatigueRest ?? 6;
    const fatigueUpkeep = config.fatigueUpkeep ?? 0.3;
    const fatigueSlow = config.fatigueSlow ?? 0.3;
    const diseaseOn = config.diseaseEnabled !== false;
    const sickBase = config.sickBase ?? 0.00002;
    const sickTicks = config.sickTicks ?? 120;
    const sickUpkeep = config.sickUpkeep ?? 0.8;
    const sickFedHeal = config.sickFedHeal ?? 1;
    const fatigue = people.fatigue;
    const sick = people.sick;
    const genes = people.genes;
    const elderAge = Math.floor((config.maxAge ?? 21600) * 0.75);
    const injury = people.injury;
    const igniteBrush = config.fireIgniteBrush ?? 6;
    const igniteChance = config.fireIgniteChance ?? 0.2;
    const thirstOn = config.finiteResourcesEnabled !== false && config.thirstEnabled !== false;
    const thirstRate = config.thirstRate ?? 0.4;
    const thirstMax = config.thirstMax ?? 100;
    const drinkRate = config.drinkRate ?? 25;
    const thirstWarn = config.thirstWarn ?? 30;
    const thirstUpkeep = config.thirstUpkeep ?? 0.5;
    const dehydration = config.dehydrationDamage ?? 0.5;
    const hydration = people.hydration;
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
      // Standing in a nest is warmer and drier: upkeep is lower.
      const upCell = (py[slot] << 8) | px[slot];
      const upkeep = land.structure[upCell] === 1 ? metabolism * hutUpkeepMul
        : nestsOn && land.form[upCell] === FORM_NEST ? metabolism * nestUpkeep : metabolism;
      energy[slot] -= upkeep;
      ledger.upkeep += upkeep;
      if (coldOn) {
        const cell = (py[slot] << 8) | px[slot];
        const cold = land.coldAt(cell);
        if (cold > 0 && !land.sheltered(cell)) {
          const extra = metabolism * coldUpkeep * cold;
          energy[slot] -= extra;
          ledger.upkeep += extra;
        }
      }
      if (injuryOn && injury[slot] > 0) {
        const extra = metabolism * injuryUpkeep * (injury[slot] / 255);
        energy[slot] -= extra;
        ledger.upkeep += extra;
        if (energy[slot] >= healAbove) injury[slot] = Math.max(0, injury[slot] - injuryHeal);
      }
      if (fatigueOn && fatigue[slot] > 0) {
        const extra = metabolism * fatigueUpkeep * (fatigue[slot] / 255);
        energy[slot] -= extra;
        ledger.upkeep += extra;
      }
      if (diseaseOn) {
        if (sick[slot] > 0) {
          const extra = metabolism * sickUpkeep;
          energy[slot] -= extra;
          ledger.upkeep += extra;
          const heal = 1 + (energy[slot] >= healAbove ? sickFedHeal : 0);
          sick[slot] = sick[slot] > heal ? sick[slot] - heal : 0;
        } else {
          // Falls ill with no contact now and then (a hash of tick and slot: no random draw), more in the cold.
          const hs = (Math.imul(tick + 13, 3266489917) ^ Math.imul(slot + 1, 2654435761)) >>> 0;
          const cold = coldOn ? land.coldAt((py[slot] << 8) | px[slot]) : 0;
          if (hs / 4294967296 < sickBase * (1 + cold)) sick[slot] = sickTicks;
        }
      }
      if (careOn && age[slot] < adultAge && motherId[slot] !== 0) {
        // A young child costs its mother, shared with her mate, while they are close.
        const mom = slotFromId(motherId[slot]);
        if (mom < cap && alive[mom] === 1 && people.idOf(mom) === motherId[slot]) {
          const ddx = Math.abs(px[mom] - px[slot]);
          const ddy = Math.abs(py[mom] - py[slot]);
          if ((ddx < 128 ? ddx : 256 - ddx) <= careRadius && (ddy < 128 ? ddy : 256 - ddy) <= careRadius) {
            let share = childCare;
            const dad = mateId[mom] !== 0 ? slotFromId(mateId[mom]) : -1;
            if (dad >= 0 && dad < cap && alive[dad] === 1 && people.idOf(dad) === mateId[mom]) {
              const ex = Math.abs(px[dad] - px[slot]);
              const ey = Math.abs(py[dad] - py[slot]);
              if ((ex < 128 ? ex : 256 - ex) <= careRadius && (ey < 128 ? ey : 256 - ey) <= careRadius) {
                share = childCare * 0.5;
                energy[dad] -= share;
                ledger.upkeep += share;
              }
            }
            energy[mom] -= share;
            ledger.upkeep += share;
          }
        }
      }
      if (thirstOn) {
        let h = hydration[slot] - thirstRate;
        if (land.waterDist[(py[slot] << 8) | px[slot]] <= 1) h = Math.min(thirstMax, h + drinkRate + thirstRate);
        if (h <= 0) {
          h = 0;
          energy[slot] -= dehydration;
          ledger.upkeep += dehydration;
        } else if (h < thirstWarn) {
          const extra = metabolism * thirstUpkeep;
          energy[slot] -= extra;
          ledger.upkeep += extra;
        }
        hydration[slot] = h;
      }

      // Starvation death
      if (energy[slot] <= 0) {
        if (energy[slot] < 0) {
          ledger.overdraft += -energy[slot];
        }
        fields.depositDanger(px[slot], py[slot], dangerDeath);
        if (injury[slot] > 0 || sick[slot] > 0) land.markDeath(px[slot], py[slot], graveTicks);
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

    // The drop-at-crowd rule counts people per tile, so it needs an index of where everyone stands
    // now. Building it here (not reusing last tick's) keeps a loaded save identical to the original.
    if (config.stockpilesEnabled !== false) spatial.build(people);

    // 4. Foraging (a little seed comes away with each bite)
    const farmOn = config.farmingPhysicsEnabled !== false;
    const seedPickup = config.seedPickupPerBite ?? 0.1;
    const seedCarryMax = config.seedCarryMax ?? 3.0;
    const seedDropBelow = (config.seedDropEnergy ?? 0.4) * maxEnergy;
    const stockOn = config.stockpilesEnabled !== false;
    const hoardAbove = (config.hoardEnergy ?? 0.85) * maxEnergy;
    const hoardLandFrac = config.hoardLandFraction ?? 0.5;
    const foodBite = config.foodBite ?? 2.0;
    const foodCarryMax = config.foodCarryMax ?? 20.0;
    const pileEatBelow = (config.pileEatBelow ?? 0.5) * maxEnergy;
    const pileEatBite = config.pileEatBite ?? 5.0;
    const carryKind = people.carryKind;
    const brushAbove = (config.brushEnergy ?? 0.6) * maxEnergy;
    const brushBite = config.brushBite ?? 1.0;
    const brushCarryMax = config.brushCarryMax ?? 10.0;
    const buildOn = config.buildingEnabled !== false && stockOn;
    const stoneAbove = (config.stoneEnergy ?? 0.6) * maxEnergy;
    const stoneBite = config.stoneBite ?? 1.0;
    const stoneCarryMax = config.stoneCarryMax ?? 8.0;
    // Meat is a food heap, so hunting needs the stockpile mechanics on.
    const huntOn = !!herds && config.huntingEnabled !== false && config.herdsEnabled !== false && config.stockpilesEnabled !== false;
    const huntBelow = (config.huntBelow ?? 0.6) * maxEnergy;
    const huntChance = config.huntChance ?? 0.15;
    const huntCost = config.huntCost ?? 0.3;
    const meatFactor = config.huntMeatFactor ?? 1.0;
    const finiteOn = config.finiteResourcesEnabled !== false;
    const berryBite = config.berryBite ?? 1.5;
    const fishBite = config.fishBite ?? 0.3;
    const fishBelow = (config.fishBelow ?? 0.5) * maxEnergy;
    const berryBelow = (config.berryBelow ?? 0.8) * maxEnergy;
    const dropCrowd = config.dropCrowd ?? 3;
    const dropWhenFull = config.dropWhenFull ?? false;
    const carryDrag = config.carryDrag ?? 0.5;
    const bodyMul = (slot: number): number =>
      (stagesOn ? stageWork(age[slot], adultAge, elderAge, childWork, elderWork) : 1) *
      (1 + strengthCarry * (genes[slot * GENE_COUNT + GENE_STRENGTH] / 255 - 0.5));
    for (let slot = 0; slot < cap; slot++) {
      if (alive[slot] === 0) continue;

      const cm = bodyMul(slot);
      const fb = forageBite * cm;
      const foodCap = foodCarryMax * cm;
      const brushCap = brushCarryMax * cm;
      const stoneCap = stoneCarryMax * cm;
      const curE = energy[slot];
      if (curE < maxEnergy) {
        let eaten = 0;
        if (stockOn && curE < pileEatBelow) {
          // Hungry: eat what is carried, then any heap underfoot.
          if (carryKind[slot] === CARRY_FOOD && people.carry[slot] > 0) {
            const own = Math.min(pileEatBite, people.carry[slot], maxEnergy - curE);
            people.carry[slot] -= own;
            if (people.carry[slot] <= 0.001) {
              people.carry[slot] = 0;
              carryKind[slot] = CARRY_NONE;
            }
            eaten += own;
          }
          if (eaten < maxEnergy - curE) {
            eaten += land.takePile(px[slot], py[slot], Math.min(pileEatBite, maxEnergy - curE - eaten));
          }
        }
        if (eaten < Math.min(fb, maxEnergy - curE)) {
          eaten += land.graze(px[slot], py[slot], Math.min(fb, maxEnergy - curE) - eaten, config, people.prevDir[slot] === 4);
          if (eaten > 0 && farmOn && carryKind[slot] !== CARRY_FOOD && carryKind[slot] !== CARRY_BRUSH) {
            const c = people.carry[slot] + seedPickup;
            people.carry[slot] = c > seedCarryMax ? seedCarryMax : c;
            carryKind[slot] = CARRY_SEED;
          }
        }
        if (finiteOn && eaten < Math.min(fb, maxEnergy - curE) && curE < berryBelow) {
          // Grazing fell short: top the meal up with wild berries.
          eaten += land.pickBerries(px[slot], py[slot], Math.min(berryBite, maxEnergy - curE - eaten));
        }
        if (finiteOn && eaten < Math.min(fb, maxEnergy - curE) && curE < fishBelow) {
          // Still hungry beside water: take a little fish from the shore.
          eaten += land.catchFish(px[slot], py[slot], Math.min(fishBite, maxEnergy - curE - eaten));
        }
        if (huntOn && herds!.count > 0 && curE < huntBelow) {
          // Hungry with an animal on or beside the tile: a chance to strike. A kill leaves the meat
          // as a food heap at the hunter's feet (the animal's own energy, plant-side) and the
          // hunter takes the first bite.
          const hx = px[slot], hy = py[slot];
          let prey = herds!.cellSlot[(hy << 8) | hx];
          if (prey < 0) prey = herds!.cellSlot[(hy << 8) | ((hx + 1) & 255)];
          if (prey < 0) prey = herds!.cellSlot[(hy << 8) | ((hx - 1) & 255)];
          if (prey < 0) prey = herds!.cellSlot[(((hy + 1) & 255) << 8) | hx];
          if (prey < 0) prey = herds!.cellSlot[(((hy - 1) & 255) << 8) | hx];
          if (prey >= 0) {
            energy[slot] -= huntCost;
            ledger.move += huntCost;
            if (herds!.roll() < huntChance) {
              land.dropFood(hx, hy, herds!.energy[prey] * meatFactor, config);
              herds!.kill(prey);
              herds!.killed++;
              herds!.addCarcass(hx, hy, config.carcassTicks ?? 120);
              eaten += land.takePile(hx, hy, Math.min(pileEatBite, maxEnergy - curE - eaten));
            }
          }
        }
        if (eaten > 0) {
          energy[slot] += eaten; // (a strike above may already have cost labour)
          ledger.plantMeal += eaten;
        }
      }
      if (stockOn && energy[slot] >= hoardAbove && people.carry[slot] < foodCap && carryKind[slot] !== CARRY_BRUSH && carryKind[slot] !== CARRY_STONE) {
        // Well fed and standing on plenty: gather a little surplus to carry. Hands are full of
        // one thing at a time, so any seeds are set down on the spot first.
        const cell = (py[slot] << 8) | px[slot];
        if (land.food[cell] >= hoardLandFrac * land.capacityAt(cell, config)) {
          if (carryKind[slot] === CARRY_SEED) {
            land.dropSeeds(px[slot], py[slot], people.carry[slot], config);
            people.carry[slot] = 0;
            carryKind[slot] = CARRY_NONE;
          }
          const got = land.graze(px[slot], py[slot], Math.min(foodBite * cm, foodCap - people.carry[slot]), config, false);
          if (got > 0) {
            people.carry[slot] += got;
            carryKind[slot] = CARRY_FOOD;
          }
        }
      }
      if (
        nestsOn && stockOn && energy[slot] >= brushAbove && people.carry[slot] < brushCap &&
        land.wooded[(py[slot] << 8) | px[slot]] === 1 && carryKind[slot] !== CARRY_FOOD && carryKind[slot] !== CARRY_STONE
      ) {
        // Well fed and passing through woodland: pick up brush. Hands hold one thing at a time,
        // so any seeds are set down first.
        if (carryKind[slot] === CARRY_SEED) {
          land.dropSeeds(px[slot], py[slot], people.carry[slot], config);
          people.carry[slot] = 0;
        }
        const cut = land.cutBrush(px[slot], py[slot], brushBite, config);
        if (cut > 0) {
          const have = carryKind[slot] === CARRY_BRUSH ? people.carry[slot] : 0;
          people.carry[slot] = Math.min(brushCap, have + cut);
          carryKind[slot] = CARRY_BRUSH;
        }
      }
      if (
        buildOn && energy[slot] >= stoneAbove && people.carry[slot] < stoneCap &&
        land.stone[(py[slot] << 8) | px[slot]] > 0 && (carryKind[slot] === CARRY_NONE || carryKind[slot] === CARRY_STONE || people.carry[slot] <= 0)
      ) {
        // Well fed and standing on rock: pick up stone (hands hold one thing, so nothing else is carried).
        const got = land.quarry(px[slot], py[slot], Math.min(stoneBite * cm, stoneCap - (carryKind[slot] === CARRY_STONE ? people.carry[slot] : 0)));
        if (got > 0) {
          people.carry[slot] = (carryKind[slot] === CARRY_STONE ? people.carry[slot] : 0) + got;
          carryKind[slot] = CARRY_STONE;
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
      // A tired person resting where they stand drops the seeds they carry.
      if (farmOn && dir === 4 && carryKind[slot] === CARRY_SEED && people.carry[slot] > 0 && energy[slot] < seedDropBelow) {
        land.dropSeeds(px[slot], py[slot], people.carry[slot], config);
        people.carry[slot] = 0;
        carryKind[slot] = CARRY_NONE;
      }
      // A carrier resting where people congregate unloads brush on the spot too.
      if (nestsOn && stockOn && dir === 4 && carryKind[slot] === CARRY_BRUSH && people.carry[slot] > 0) {
        const c = (py[slot] << 8) | px[slot];
        // Brush is carried out of the woods to where people gather, never unloaded among the trees.
        if (land.wooded[c] === 0 && spatial.cellStarts[c + 1] - spatial.cellStarts[c] >= dropCrowd) {
          land.dropBrush(px[slot], py[slot], people.carry[slot], config);
          people.carry[slot] = 0;
          carryKind[slot] = CARRY_NONE;
        }
      }
      // A carrier resting where people congregate (off the rock) sets the stone down: it builds that tile up.
      if (buildOn && dir === 4 && carryKind[slot] === CARRY_STONE && people.carry[slot] > 0) {
        const c = (py[slot] << 8) | px[slot];
        if (land.stone[c] <= 0 && spatial.cellStarts[c + 1] - spatial.cellStarts[c] >= dropCrowd) {
          land.build(px[slot], py[slot], people.carry[slot], config);
          people.carry[slot] = 0;
          carryKind[slot] = CARRY_NONE;
        }
      }
      // A cold person resting on a big enough brush heap lights it (a hash of tick and cell, no random draw).
      if (firesOn && dir === 4) {
        const c = (py[slot] << 8) | px[slot];
        if (land.brush[c] >= igniteBrush && land.fire[c] === 0 && land.coldAt(c) > 0.2 && land.wooded[c] === 0) {
          const hsh = (Math.imul(tick + 1, 2654435761) ^ Math.imul(c + 1, 40503)) >>> 0;
          if (hsh / 4294967296 < igniteChance) land.ignite(c, config);
        }
      }
      // A carrier resting where people congregate (or who is full) unloads the food on the spot.
      if (stockOn && dir === 4 && carryKind[slot] === CARRY_FOOD && people.carry[slot] > 0) {
        const c = (py[slot] << 8) | px[slot];
        const here = spatial.cellStarts[c + 1] - spatial.cellStarts[c];
        if (here >= dropCrowd || (dropWhenFull && people.carry[slot] >= foodCarryMax - 0.01)) {
          land.dropFood(px[slot], py[slot], people.carry[slot], config);
          people.carry[slot] = 0;
          carryKind[slot] = CARRY_NONE;
        }
      }

      // A tired person loses some steps too, and standing still rests them.
      if (fatigueOn) {
        if (dir === 4) {
          fatigue[slot] = fatigue[slot] > fatigueRest ? fatigue[slot] - fatigueRest : 0;
        } else {
          const hf = (Math.imul(tick + 11, 668265263) ^ Math.imul(slot + 1, 374761393)) >>> 0;
          if (hf / 4294967296 < fatigueSlow * (fatigue[slot] / 255)) dir = 4;
        }
      }
      // A wounded person loses some steps (a hash of tick and slot: no random draw).
      if (injuryOn && dir < 4 && injury[slot] > 0) {
        const hs = (Math.imul(tick + 7, 2246822519) ^ Math.imul(slot + 1, 3266489917)) >>> 0;
        if (hs / 4294967296 < injurySlow * (injury[slot] / 255)) dir = 4;
      }
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
          // Carrying food is heavy: the more carried, the dearer each step.
          const stepCost =
            carryKind[slot] === CARRY_FOOD ? moveCost * (1 + carryDrag * people.carry[slot] / (foodCarryMax * bodyMul(slot)))
            : carryKind[slot] === CARRY_BRUSH ? moveCost * (1 + carryDrag * people.carry[slot] / (brushCarryMax * bodyMul(slot)))
            : carryKind[slot] === CARRY_STONE ? moveCost * (1 + carryDrag * people.carry[slot] / (stoneCarryMax * bodyMul(slot)))
            : moveCost;
          energy[slot] -= stepCost;
          ledger.move += stepCost;
          if (fatigueOn) fatigue[slot] = fatigue[slot] + fatigueMove > 255 ? 255 : fatigue[slot] + fatigueMove;

          if (energy[slot] <= 0) {
            if (energy[slot] < 0) {
              ledger.overdraft += -energy[slot];
            }
            fields.depositDanger(nx, ny, dangerDeath);
            if (injury[slot] > 0 || sick[slot] > 0) land.markDeath(nx, ny, graveTicks);
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

    // 9b. Idle, well-fed people tamp the heap underfoot. This is labour, not a build order: each
    // tamp costs a little energy and adds compaction; a big enough compacted heap becomes a
    // granary floor on its own (see Land.step).
    if (stockOn) {
      const workAbove = (config.workEnergy ?? 0.7) * maxEnergy;
      const workMin = config.workMinPile ?? 4.0;
      const workCost = config.workCost ?? 0.05;
      const brushWorkMin = nestsOn ? config.brushWorkMin ?? 3.0 : Infinity;
      for (let slot = 0; slot < cap; slot++) {
        if (alive[slot] === 0 || people.prevDir[slot] !== 4 || energy[slot] < workAbove) continue;
        const wc = (py[slot] << 8) | px[slot];
        if (land.pile[wc] < workMin && land.brush[wc] < brushWorkMin) continue;
        land.tamp(px[slot], py[slot], config);
        energy[slot] -= workCost;
        ledger.move += workCost; // labour is booked with the other actions
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
