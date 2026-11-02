import type { SimulationConfig } from './types';

export const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;

/** Where in the year a tick falls, 0 up to (not including) 1. Spring starts at 0. */
export function yearPhase(tick: number, config: Readonly<SimulationConfig>): number {
  const tpy = config.ticksPerYear || 360;
  return (tick % tpy) / tpy;
}

/** 0 spring, 1 summer, 2 autumn, 3 winter. */
export function seasonIndex(tick: number, config: Readonly<SimulationConfig>): number {
  return Math.min(3, Math.floor(yearPhase(tick, config) * 4));
}

export function seasonName(tick: number, config: Readonly<SimulationConfig>): string {
  return SEASON_NAMES[seasonIndex(tick, config)];
}

/**
 * Multiplier on plant regrowth: peaks in mid-summer, bottoms out in mid-winter, and averages 1
 * over a year, so the food balance stays close to the seasonless one. Pure function of the tick.
 */
export function seasonGrowthFactor(tick: number, config: Readonly<SimulationConfig>): number {
  if (config.seasonsEnabled === false) return 1;
  const amp = config.seasonAmplitude ?? 0.8;
  return 1 + amp * Math.sin(2 * Math.PI * (yearPhase(tick, config) - 0.125));
}
