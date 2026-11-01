import { World } from '../src/sim/world';
import { Rules } from '../src/sim/rules';

interface CliArgs {
  seed: number;
  years: number;
  touch: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let seed = 42;
  let years = 200;
  let touch = true;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--seed' && i + 1 < args.length) {
      seed = parseInt(args[++i], 10);
    } else if (args[i] === '--years' && i + 1 < args.length) {
      years = parseInt(args[++i], 10);
    } else if (args[i] === '--touch' && i + 1 < args.length) {
      touch = args[++i].toLowerCase() !== 'off' && args[i].toLowerCase() !== 'false';
    } else if (args[i] === '--touch=off' || args[i] === '--no-touch') {
      touch = false;
    } else if (args[i] === '--touch=on') {
      touch = true;
    }
  }

  return { seed, years, touch };
}

function runBands(): void {
  const { seed, years, touch } = parseArgs();
  console.log(`\n=== Band Measurement: Seed ${seed}, ${years} Years, Touch: ${touch ? 'ON' : 'OFF'} ===\n`);

  const world = new World({ touchEnabled: touch }, seed);
  const ticksPerYear = world.config.ticksPerYear || 360;
  const decisionInterval = world.config.decisionStaggerInterval || 8;

  const people = world.people;
  let prevLeaders = new Uint32Array(people.capacity);

  // Initialize previous leaders
  for (let s = 0; s < people.capacity; s++) {
    if (people.alive[s] === 1) {
      const l = people.leaderId[s];
      prevLeaders[s] = l !== 0 && people.isValidId(l) && l !== people.idOf(s) ? l : 0;
    }
  }

  console.log(
    `| Decade |   Pop  | % Follow | Bands 5+ | Bands 20+ | Max Band | Retention % | Clashes/yr (Strangers / SameBand / Leader / Kin) |`
  );
  console.log(
    `|:------:|:------:|:--------:|:--------:|:---------:|:--------:|:-----------:|:------------------------------------------------:|`
  );

  let decadeRetained = 0;
  let decadeEvaluated = 0;
  Rules.resetClashStats();

  for (let y = 1; y <= years; y++) {
    for (let t = 0; t < ticksPerYear; t++) {
      world.step();

      // Check leader retention on decision cycle boundary
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

      // Group people by rootLeaderId
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

      console.log(
        `|   ${decadeNum.toString().padStart(2, ' ')}   | ${pop.toString().padStart(6, ' ')} |  ${pctFollowing.padStart(5, ' ')}%  |   ${bands5.toString().padStart(4, ' ')}   |    ${bands20.toString().padStart(4, ' ')}   |   ${maxBand.toString().padStart(5, ' ')}  |    ${retentionPct.padStart(5, ' ')}%   | ${sPerYr.padStart(6, ' ')} / ${bPerYr.padStart(4, ' ')} / ${lPerYr.padStart(4, ' ')} / ${kPerYr.padStart(4, ' ')} |`
      );

      decadeRetained = 0;
      decadeEvaluated = 0;
      Rules.resetClashStats();
    }
  }

  console.log(`\nFinished ${years} years. Final state hash: ${world.stateHash()}\n`);
}

runBands();
