import { describe, expect, it } from 'vitest';
import { bendGlyphFor, holdPose, popShape, poseFor, POSE_HOLD_MS, POP_MS } from '../src/render/poses';
import { POSE_BEND, POSE_HOLD, POSE_KNEEL, POSE_SIT, POSE_STRIKE } from '../src/render/sprites';
import {
  ACT_BUILD, ACT_DRINK, ACT_EAT, ACT_FIGHT, ACT_FISH, ACT_FLEE, ACT_GATHER, ACT_GRAZE, ACT_HUNT, ACT_IDLE, ACT_NURSE, ACT_REST, ACT_TEND, ACT_WALK, EV_KILL,
} from '../src/sim/activity';
import {
  CARRY_BRUSH, CARRY_FOOD, CARRY_NONE, CARRY_SEED, CARRY_STONE,
} from '../src/sim/people';

describe('Watchability #3b: poses', () => {
  it('maps each action to its pose, ignoring event bits', () => {
    expect(poseFor(ACT_GRAZE | EV_KILL)).toBe(POSE_BEND);
    expect(poseFor(ACT_BUILD)).toBe(POSE_BEND);
    expect(poseFor(ACT_DRINK)).toBe(POSE_KNEEL);
    expect(poseFor(ACT_FISH)).toBe(POSE_KNEEL);
    expect(poseFor(ACT_REST)).toBe(POSE_SIT);
    expect(poseFor(ACT_NURSE)).toBe(POSE_HOLD);
    expect(poseFor(ACT_HUNT)).toBe(POSE_STRIKE);
    expect(poseFor(ACT_FIGHT)).toBe(POSE_STRIKE);
    for (const a of [ACT_IDLE, ACT_WALK, ACT_FLEE]) expect(poseFor(a)).toBe(0);
  });

  it('holds a short action for its hold time, and a new one replaces it', () => {
    const shown = new Uint8Array(2);
    const until = new Float64Array(2);
    expect(holdPose(shown, until, 1, POSE_KNEEL, 1000)).toBe(POSE_KNEEL);
    expect(until[1]).toBe(1000 + POSE_HOLD_MS);
    expect(holdPose(shown, until, 1, 0, 1000 + POSE_HOLD_MS - 1)).toBe(POSE_KNEEL);
    expect(holdPose(shown, until, 1, 0, 1000 + POSE_HOLD_MS)).toBe(0);
    holdPose(shown, until, 1, POSE_KNEEL, 1100);
    expect(holdPose(shown, until, 1, POSE_BEND, 1200)).toBe(POSE_BEND);
    expect(shown[0]).toBe(0);
  });

  it('a pop rises and is gone by the end of its life', () => {
    expect(popShape(0).alpha).toBe(1);
    expect(popShape(POP_MS * 0.9).rise).toBeGreaterThan(popShape(POP_MS * 0.1).rise);
    expect(popShape(POP_MS).alpha).toBe(0);
  });

  it('bendGlyphFor distinguishes foraging, planting, carrying, tamping, and wall-building', () => {
    expect(bendGlyphFor(ACT_BUILD, CARRY_NONE)).toBe('build');
    expect(bendGlyphFor(ACT_TEND, CARRY_NONE)).toBe('tend');
    expect(bendGlyphFor(ACT_GATHER, CARRY_SEED)).toBe('seed');
    expect(bendGlyphFor(ACT_GRAZE, CARRY_NONE)).toBe('food');
    expect(bendGlyphFor(ACT_EAT, CARRY_NONE)).toBe('food');
    expect(bendGlyphFor(ACT_GATHER, CARRY_FOOD)).toBe('food');
    expect(bendGlyphFor(ACT_GATHER, CARRY_STONE)).toBe('stone');
    expect(bendGlyphFor(ACT_GATHER, CARRY_BRUSH)).toBe('brush');
    expect(bendGlyphFor(ACT_IDLE, CARRY_NONE)).toBe(0);
  });

  it('holdPose tracks the held activity in shownAct until the pose expires', () => {
    const shown = new Uint8Array(2);
    const shownAct = new Uint8Array(2);
    const until = new Float64Array(2);
    expect(holdPose(shown, until, 1, POSE_BEND, 1000, shownAct, ACT_BUILD)).toBe(POSE_BEND);
    expect(shownAct[1]).toBe(ACT_BUILD);
    expect(holdPose(shown, until, 1, 0, 1500, shownAct, ACT_IDLE)).toBe(POSE_BEND);
    expect(shownAct[1]).toBe(ACT_BUILD);
    expect(holdPose(shown, until, 1, 0, 1000 + POSE_HOLD_MS, shownAct, ACT_IDLE)).toBe(0);
    expect(shownAct[1]).toBe(0);
  });
});
