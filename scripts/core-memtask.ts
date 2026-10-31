import { ACTIONS, ACTION_COUNT, GENOME_LENGTH, HIDDEN_COUNT, INPUT_COUNT, MEMORY_COUNT, MEMORY_START, OUTPUT_COUNT, forward } from '../src/core/brain';
import { PRNG } from '../src/sim/prng';

/**
 * Delayed-cue task, standalone (no world): a cue of +1 or -1 on input 0 for one tick,
 * then `delay` silent ticks, then the net must score EAT above STAY for +1 and below for -1.
 * Mutate-and-select with memory on, and with memory wiped every tick (the control: the cue
 * is gone when the answer is due, so the best possible score is chance).
 * With `noise` > 0, every silent tick also carries random distractor values (uniform in
 * [-noise, noise]) on the neighbour and cell inputs, so a net must hold the cue against clutter.
 * Usage: npm run core:memtask -- <delay> <generations> <noise>
 */
const delay = Number(process.argv[2] ?? 6);
const generations = Number(process.argv[3] ?? 300);
const noise = Number(process.argv[4] ?? 0);
const NOISE_DRAWS = 4;
const popSize = 100;
const keep = 20;

const hidden = new Float64Array(HIDDEN_COUNT);
const out = new Float64Array(OUTPUT_COUNT);
const inputs = new Float64Array(INPUT_COUNT);
const memory = new Float64Array(MEMORY_COUNT);

function answer(genome: Float32Array, cue: number, keepMemory: boolean, draw: number): number {
  memory.fill(0);
  const clutter = new PRNG(`clutter:${draw}`); // the same distractors for every genome
  for (let t = 0; t <= delay; t++) {
    inputs.fill(0);
    if (t > 0 && noise > 0) for (let i = 3; i < MEMORY_START; i++) inputs[i] = clutter.nextFloat(-noise, noise);
    inputs[0] = t === 0 ? cue : 0;
    for (let m = 0; m < MEMORY_COUNT; m++) inputs[MEMORY_START + m] = memory[m];
    forward(genome, 0, inputs, hidden, out);
    for (let m = 0; m < MEMORY_COUNT; m++) memory[m] = keepMemory ? Math.tanh(out[ACTION_COUNT + m]) : 0;
  }
  return out[ACTIONS.EAT] - out[ACTIONS.STAY];
}

/** Mean clipped margin on the correct side (0 at chance), and whether both cues are answered right. */
function score(genome: Float32Array, keepMemory: boolean): { fitness: number; solved: boolean } {
  const clip = (v: number): number => Math.max(-1, Math.min(1, v));
  let fitness = 0;
  let solved = true;
  for (let d = 0; d < NOISE_DRAWS; d++) {
    const plus = answer(genome, 1, keepMemory, d);
    const minus = answer(genome, -1, keepMemory, d);
    fitness += (clip(plus) - clip(minus)) / 2 / NOISE_DRAWS;
    if (!(plus > 0 && minus < 0)) solved = false;
  }
  return { fitness, solved };
}

for (const keepMemory of [true, false]) {
  const results: string[] = [];
  for (const seed of [1, 2, 3, 4]) {
    const rng = new PRNG(`memtask:${seed}`);
    let pop: Float32Array[] = [];
    for (let i = 0; i < popSize; i++) {
      const g = new Float32Array(GENOME_LENGTH);
      for (let k = 0; k < g.length; k++) g[k] = rng.nextGaussian(0, 0.6);
      pop.push(g);
    }
    let solvedAt = -1;
    let best = 0;
    for (let gen = 0; gen < generations; gen++) {
      const ranked = pop.map((g) => ({ g, ...score(g, keepMemory) })).sort((a, b) => b.fitness - a.fitness);
      best = ranked[0].fitness;
      if (solvedAt < 0 && ranked[0].solved) solvedAt = gen;
      const parents = ranked.slice(0, keep).map((r) => r.g);
      pop = [...parents];
      while (pop.length < popSize) {
        const child = Float32Array.from(parents[rng.nextInt(0, keep - 1)]);
        for (let k = 0; k < child.length; k++) if (rng.next() < 0.05) child[k] += rng.nextGaussian(0, 0.3);
        pop.push(child);
      }
    }
    results.push(`seed ${seed}: best fitness ${best.toFixed(2)}, first solved ${solvedAt < 0 ? 'never' : 'gen ' + solvedAt}`);
  }
  console.log(`memory ${keepMemory ? 'ON ' : 'WIPED'} (delay ${delay}, noise ${noise}, ${generations} gens):\n  ` + results.join('\n  '));
}
