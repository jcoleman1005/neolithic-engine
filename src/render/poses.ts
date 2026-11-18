/**
 * Watchability #3b: which figure frame shows what a person is doing. Pure functions, no browser,
 * so they can be tested. The renderer keeps the per-person state in typed arrays.
 */
import {
  ACT_BUILD, ACT_DRINK, ACT_EAT, ACT_FIGHT, ACT_FISH, ACT_GATHER, ACT_GRAZE, ACT_HUNT, ACT_MASK, ACT_NURSE,
  ACT_REST, ACT_TEND,
} from '../sim/activity';
import {
  CARRY_BRUSH, CARRY_EARTH, CARRY_FOOD, CARRY_SEED, CARRY_STONE, CARRY_WATER,
} from '../sim/people';
import { POSE_BEND, POSE_HOLD, POSE_KNEEL, POSE_SIT, POSE_STRIKE } from './sprites';

export type BendGlyph = 'seed' | 'food' | 'stone' | 'brush' | 'earth' | 'water' | 'tend' | 'build';

/** How long a pose stays on screen after the action that set it, in real milliseconds. */
export const POSE_HOLD_MS = 1000;
/** How long an event pop (kill, birth, fire, finished hut) lasts, in real milliseconds. */
export const POP_MS = 1800;

/** Pose frame for an action (0 = stand idle). Walking, fleeing and giving way use the walk frames. */
export function poseFor(activity: number): number {
  switch (activity & ACT_MASK) {
    case ACT_REST: return POSE_SIT;
    case ACT_TEND:
    case ACT_GRAZE:
    case ACT_GATHER:
    case ACT_EAT:
    case ACT_BUILD: return POSE_BEND;
    case ACT_FISH:
    case ACT_DRINK: return POSE_KNEEL;
    case ACT_NURSE: return POSE_HOLD;
    case ACT_HUNT:
    case ACT_FIGHT: return POSE_STRIKE;
    default: return 0;
  }
}

/**
 * The pose to show for a standing person, updating `shown` and `until` for that slot in place (no
 * allocation in the draw loop): a new pose replaces the old one and restarts its hold; with no new
 * pose, the old one stays until its hold runs out.
 */
export function holdPose(
  shown: Uint8Array,
  until: Float64Array,
  slot: number,
  incoming: number,
  nowMs: number,
  shownAct?: Uint8Array,
  incomingAct = 0
): number {
  if (incoming !== 0) {
    shown[slot] = incoming;
    until[slot] = nowMs + POSE_HOLD_MS;
    if (shownAct) shownAct[slot] = incomingAct & ACT_MASK;
  } else if (shown[slot] !== 0 && nowMs >= until[slot]) {
    shown[slot] = 0;
    if (shownAct) shownAct[slot] = 0;
  }
  return shown[slot];
}

/** Tiny glyph to show beside a bent-over person's head when zoomed in, so foraging, planting, tamping and building look distinct. */
export function bendGlyphFor(activity: number, carryKind: number): BendGlyph | 0 {
  const act = activity & ACT_MASK;
  if (act === ACT_BUILD) return 'build';
  if (act === ACT_TEND) return 'tend';
  switch (carryKind & 7) {
    case CARRY_SEED: return 'seed';
    case CARRY_FOOD: return 'food';
    case CARRY_STONE: return 'stone';
    case CARRY_BRUSH: return 'brush';
    case CARRY_EARTH: return 'earth';
    case CARRY_WATER: return 'water';
    default:
      return act === ACT_GRAZE || act === ACT_EAT ? 'food' : 0;
  }
}

/** Rise in art pixels and opacity of a pop `age` ms old (0 to POP_MS): it pops up fast, floats, then fades. */
export function popShape(age: number): { rise: number; alpha: number; scale: number } {
  const t = Math.max(0, Math.min(1, age / POP_MS));
  const scale = age < 150 ? 0.6 + 0.4 * (age / 150) : 1;
  const rise = 2 + 6 * (1 - (1 - t) * (1 - t));
  const alpha = t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.4);
  return { rise, alpha, scale };
}
