/**
 * Core controller (rule 66, 179): a small recurrent net whose weights are the
 * genome. Inputs are local only (rules 42 to 45). Memory is a short vector the
 * net reads as inputs and rewrites as extra outputs every tick; it lives for one
 * life and is not inherited (rule 68: no lifetime learning is claimed). A
 * growable hidden layer is a later stage (docs/rules-catalog.md, section N).
 *
 * Genome layout: [hidden weights H x I][hidden biases H][output weights O x H][output biases O].
 */

export const ACTIONS = {
  /** 0..7 are moves: N, NE, E, SE, S, SW, W, NW. */
  MOVE_0: 0,
  EAT: 8,
  STAY: 9,
  REPRODUCE: 10,
  EAT_CORPSE: 11,
} as const;
export const ACTION_COUNT = 12;

/** Memory units carried from tick to tick. */
export const MEMORY_COUNT = 4;

/**
 * Per neighbour: food, occupied, wall, heading x, heading y, moved last tick,
 * ate last tick, tag similarity (rules 135, 136, 107).
 */
export const NEIGHBOUR_FEATURES = 8;
export const OWN_INPUTS = 3; // energy, age, last action worked
export const HERE_START = OWN_INPUTS + 8 * NEIGHBOUR_FEATURES; // food here, corpse here
export const MEMORY_START = HERE_START + 2;
export const INPUT_COUNT = MEMORY_START + MEMORY_COUNT;
export const OUTPUT_COUNT = ACTION_COUNT + MEMORY_COUNT; // action scores, then memory writes
export const HIDDEN_COUNT = 10;
export const GENOME_LENGTH = HIDDEN_COUNT * INPUT_COUNT + HIDDEN_COUNT + OUTPUT_COUNT * HIDDEN_COUNT + OUTPUT_COUNT;

/** Index in a genome of the output bias for output `o` (an action, or ACTION_COUNT + a memory unit). */
export function outputBiasIndex(o: number): number {
  return GENOME_LENGTH - OUTPUT_COUNT + o;
}

/** Outputs for the inputs (memory included among them), written into `outputs`. */
export function forward(
  weights: Float32Array,
  offset: number,
  inputs: Float64Array,
  hidden: Float64Array,
  outputs: Float64Array,
): void {
  let w = offset;
  const hiddenBias = offset + HIDDEN_COUNT * INPUT_COUNT;
  for (let h = 0; h < HIDDEN_COUNT; h++) {
    let sum = weights[hiddenBias + h];
    for (let i = 0; i < INPUT_COUNT; i++) sum += inputs[i] * weights[w++];
    hidden[h] = Math.tanh(sum);
  }
  w = hiddenBias + HIDDEN_COUNT;
  const outputBias = w + OUTPUT_COUNT * HIDDEN_COUNT;
  for (let o = 0; o < OUTPUT_COUNT; o++) {
    let sum = weights[outputBias + o];
    for (let h = 0; h < HIDDEN_COUNT; h++) sum += hidden[h] * weights[w++];
    outputs[o] = sum;
  }
}
