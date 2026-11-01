import { World } from '../src/sim/world';
import { Rules } from '../src/sim/rules';
import * as fs from 'fs';

interface RunResult {
  seed: number;
  touch: boolean;
  rows: string[];
}

export function runExperiment(seed: number, touch: boolean, years = 200): RunResult {
  const world = new World({ touchEnabled: touch }, seed);
  const ticksPerYear = world.config.ticksPerYear || 360;
  const decisionInterval = world.config.decisionStaggerInterval || 8;

  const people = world.people;
  let prevLeaders = new Uint32Array(people.capacity);

  for (let s = 0; s < people.capacity; s++) {
    if (people.alive[s] === 1) {
      const l = people.leaderId[s];
      prevLeaders[s] = l !== 0 && people.isValidId(l) && l !== people.idOf(s) ? l : 0;
    }
  }

  const rows: string[] = [];
  let decadeRetained = 0;
  let decadeEvaluated = 0;
  Rules.resetClashStats();

  for (let y = 1; y <= years; y++) {
    for (let t = 0; t < ticksPerYear; t++) {
      world.step();

      if (world.tick % decisionInterval === 0) {
        if (prevLeaders.length < people.capacity) {
          const nextPrev = new Uint32Array(people.capacity);
          nextPrev.set(prevLeaders);
          prevLeaders = nextPrev;
        }

        const cap = people.capacity;
        for (let s = 0; s < cap; s++) {
          const prevL = prevLeaders[s];
          if (prevL !== 0) {
            decadeEvaluated++;
            if (people.alive[s] === 1 && people.leaderId[s] === prevL) {
              decadeRetained++;
            }
          }

          if (people.alive[s] === 1) {
            const curL = people.leaderId[s];
            prevLeaders[s] = curL !== 0 && people.isValidId(curL) && curL !== people.idOf(s) ? curL : 0;
          } else {
            prevLeaders[s] = 0;
          }
        }
      }
    }

    if (y % 10 === 0) {
      const decadeNum = y / 10;
      const pop = world.population;

      const bandSizes = new Map<number, number>();
      let followingCount = 0;

      const cap = people.capacity;
      for (let s = 0; s < cap; s++) {
        if (people.alive[s] === 1) {
          const lId = people.leaderId[s];
          const myId = people.idOf(s);
          if (lId !== 0 && people.isValidId(lId) && lId !== myId) {
            followingCount++;
          }

          let rId = people.rootLeaderId[s];
          if (rId === 0) rId = myId;
          bandSizes.set(rId, (bandSizes.get(rId) ?? 0) + 1);
        }
      }

      let bands5 = 0;
      let bands20 = 0;
      let maxBand = 0;

      for (const size of bandSizes.values()) {
        if (size >= 5) bands5++;
        if (size >= 20) bands20++;
        if (size > maxBand) maxBand = size;
      }

      const pctFollowing = pop > 0 ? ((followingCount / pop) * 100).toFixed(1) : '0.0';
      const retentionPct = decadeEvaluated > 0 ? ((decadeRetained / decadeEvaluated) * 100).toFixed(1) : '0.0';

      const sPerYr = (Rules.clashStats.strangers / 10).toFixed(1);
      const bPerYr = (Rules.clashStats.sameBand / 10).toFixed(1);
      const lPerYr = (Rules.clashStats.leaderFollower / 10).toFixed(1);
      const kPerYr = (Rules.clashStats.kin / 10).toFixed(1);

      rows.push(
        `| ${decadeNum.toString().padStart(2, ' ')} | ${pop.toString().padStart(6, ' ')} | ${pctFollowing.padStart(5, ' ')}% | ${bands5.toString().padStart(4, ' ')} | ${bands20.toString().padStart(4, ' ')} | ${maxBand.toString().padStart(5, ' ')} | ${retentionPct.padStart(5, ' ')}% | ${sPerYr.padStart(7, ' ')} / ${bPerYr.padStart(4, ' ')} / ${lPerYr.padStart(4, ' ')} / ${kPerYr.padStart(4, ' ')} |`
      );

      decadeRetained = 0;
      decadeEvaluated = 0;
      Rules.resetClashStats();
    }
  }

  return { seed, touch, rows };
}

// If executed directly:
const args = process.argv.slice(2);
const seed = parseInt(args[0], 10) || 1;
const touch = args[1] !== 'off';
const outFile = args[2] || `scratch/res_${seed}_${touch ? 'on' : 'off'}.json`;

const res = runExperiment(seed, touch, 200);
fs.writeFileSync(outFile, JSON.stringify(res, null, 2));
console.log(`Finished seed ${seed} touch=${touch ? 'on' : 'off'}, written to ${outFile}`);
