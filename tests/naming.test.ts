import { describe, expect, it } from 'vitest';
import {
  TONGUE_SIZE, bandName, driftTongue, epithet, fullName, hash32, landformFor, makeTongue, personName, placeName,
  type EpithetFacts,
} from '../src/core/naming';

const calm: EpithetFacts = {
  strength: 100, cruelty: 100, charisma: 100, wisdom: 100, bravery: 100, exiles: 0, peakFollowers: 0, ageYears: 20,
};

describe('Phase 4 naming', () => {
  it('names are a pure function of their inputs', () => {
    const t = makeTongue(1234);
    expect(makeTongue(1234)).toEqual(t);
    expect(personName(77, t)).toBe(personName(77, t));
    expect(fullName(77, 9, t)).toBe(`${personName(77, t)} of the ${bandName(9, t)}`);
    expect(hash32(1, 2, 3)).toBe(hash32(1, 2, 3));
  });

  it('a tongue is a small set of distinct syllables, and different lineages differ', () => {
    const t = makeTongue(5);
    expect(t).toHaveLength(TONGUE_SIZE);
    expect(new Set(t).size).toBe(TONGUE_SIZE);
    expect(makeTongue(6)).not.toEqual(t);
  });

  it('drift replaces at most one syllable and leaves the parent untouched', () => {
    const parent = makeTongue(42);
    const copy = parent.slice();
    const child = driftTongue(parent, 999);
    expect(parent).toEqual(copy);
    expect(child).toHaveLength(parent.length);
    expect(child.filter((s, i) => s !== parent[i]).length).toBeLessThanOrEqual(1);
    expect(new Set(child).size).toBe(child.length);
  });

  it('names are capitalised words built from the tongue', () => {
    const t = makeTongue(8);
    for (let id = 1; id < 50; id++) {
      const n = personName(id, t);
      expect(n[0]).toBe(n[0].toUpperCase());
      expect(n.toLowerCase().length).toBeGreaterThan(0);
    }
  });

  it('epithets come from deeds before traits, and are null when nothing stands out', () => {
    expect(epithet(1, calm)).toBeNull();
    expect(epithet(1, { ...calm, exiles: 2, cruelty: 255 })).toBe('Twice-Exiled');
    expect(epithet(1, { ...calm, exiles: 1 })).toBe('the Exiled');
    expect(epithet(1, { ...calm, cruelty: 250 })).toBe('the Cruel');
    expect(epithet(1, { ...calm, peakFollowers: 150 })).toBe('the Great');
  });

  it('landform and place names', () => {
    expect(landformFor({ upland: 0.8, roughness: 0.9, cover: 0.2, nearWater: false })).toBe('Ridge');
    expect(landformFor({ upland: 0.1, roughness: 0.1, cover: 0.8, nearWater: true })).toBe('Marsh');
    expect(placeName('Varn', 'Ridge')).toBe('Varn Ridge');
  });
});
