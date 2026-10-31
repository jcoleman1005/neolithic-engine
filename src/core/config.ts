/**
 * Core engine configuration (docs/rules-catalog.md, `[core]` rules).
 * Every rule that can be switched has a switch; all values here are first
 * guesses, not tuned to produce any behaviour.
 */
export interface CoreConfig {
  seed: number | string;
  width: number;
  height: number;
  /** Rule 1: edges wrap instead of being walls. */
  wrap: boolean;
  /** Rule 7: cells above the noise threshold are walls. */
  wallsEnabled: boolean;
  wallThreshold: number;
  /** Rule 8: fertility noise lattice spacing (cells). */
  noiseScale: number;
  maxPopulation: number;
  founders: number;
  founderWeightSd: number;
  /** Head start: founders' EAT output bias. A starting value only; weights evolve freely (docs/findings.md, Parameter log). */
  founderEatBias: number;
  /** Head start: founders' REPRODUCE output bias (legal only above the energy threshold). */
  founderReproduceBias: number;

  // Food (rules 15 to 19)
  foodCapMax: number;
  foodRegrowth: number;
  /** Rule 19: share of capacity that regrows even from zero. */
  foodFloorRate: number;
  biteSize: number;
  /** Rule 18: EAT is legal only where at least this much food is left, so a trickle is not worth sitting on. */
  minBite: number;
  digestEfficiency: number;

  // Body (rules 29 to 34)
  maxEnergy: number;
  founderEnergy: number;
  upkeep: number;
  moveCost: number;
  diagonalMoveCost: number;
  maxAge: number;

  // Reproduction (rules 71 to 75)
  reproduceThreshold: number;
  reproduceCost: number;
  birthLoss: number;
  mutationRate: number;
  mutationStep: number;
  /** Rule 98: per-birth step of the colour tag; the tag has no function of its own. */
  tagStep: number;
  /** Rule 179: switch off to zero the recurrent state (the control arm for memory). */
  memoryEnabled: boolean;

  // Corpses (rules 24, 25, 60)
  corpsesEnabled: boolean;
  corpseFraction: number;
  corpseLifetime: number;
  meatEfficiency: number;
}

export const DEFAULT_CORE_CONFIG: CoreConfig = {
  seed: 1,
  width: 60,
  height: 60,
  wrap: false,
  wallsEnabled: true,
  wallThreshold: 0.72,
  noiseScale: 8,
  maxPopulation: 3000,
  founders: 200,
  founderWeightSd: 0.6,
  founderEatBias: 2,
  founderReproduceBias: 2,

  foodCapMax: 10,
  foodRegrowth: 0.08,
  foodFloorRate: 0.01,
  biteSize: 4,
  minBite: 1,
  digestEfficiency: 0.8,

  maxEnergy: 100,
  founderEnergy: 50,
  upkeep: 0.15,
  moveCost: 0.25,
  diagonalMoveCost: Math.SQRT2,
  maxAge: 600,

  reproduceThreshold: 60,
  reproduceCost: 30,
  birthLoss: 0.2,
  mutationRate: 0.05,
  mutationStep: 0.15,
  tagStep: 0.02,
  memoryEnabled: true,

  corpsesEnabled: true,
  corpseFraction: 0.7,
  corpseLifetime: 80,
  meatEfficiency: 0.7,
};
