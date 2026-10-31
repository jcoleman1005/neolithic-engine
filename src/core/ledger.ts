import type { CoreWorld } from './world';

export interface LedgerCheck {
  /** Change in stored energy since the last check. */
  delta: number;
  inflow: number;
  outflow: number;
  /** delta - (in - out). Must be zero; whatever the books cannot explain (rule 28, 129). */
  residual: number;
}

/**
 * Observer (rule 123): reads the world's cumulative flows, never changes it, and
 * draws no random numbers. Plants sit outside the system; their energy enters at the mouth.
 */
export class CoreLedger {
  private stored: number;
  private inflow: number;
  private outflow: number;

  constructor(private readonly world: CoreWorld) {
    this.stored = world.storedEnergy();
    this.inflow = inflowOf(world);
    this.outflow = outflowOf(world);
  }

  check(): LedgerCheck {
    const stored = this.world.storedEnergy();
    const inflow = inflowOf(this.world);
    const outflow = outflowOf(this.world);
    const delta = stored - this.stored;
    const din = inflow - this.inflow;
    const dout = outflow - this.outflow;
    this.stored = stored;
    this.inflow = inflow;
    this.outflow = outflow;
    return { delta, inflow: din, outflow: dout, residual: delta - (din - dout) };
  }
}

function inflowOf(w: CoreWorld): number {
  return w.flows.plantMeal;
}

function outflowOf(w: CoreWorld): number {
  const f = w.flows;
  return f.upkeep + f.move + f.birthLoss + f.deathLoss + f.carrionMealLoss + f.carrionRot + f.overCap;
}
