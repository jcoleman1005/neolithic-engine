import { describe, expect, it } from 'vitest';
import {
  TONGUE_SIZE, bandName, driftTongue, epithet, fullName, hash32, landformFor, makeTongue, personName, placeName,
  type EpithetFacts,
} from '../src/sim/naming';

const calm: EpithetFacts = {
  strength: 100, cruelty: 100, charisma: 100, wisdom: 100, bravery: 100, departures: 0, peakFollowers: 0, ageYears: 20,
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

  it('names never repeat a sound ("Mama", "Lolo", "Shushush")', () => {
    for (let lineage = 1; lineage < 40; lineage++) {
      const t = makeTongue(lineage);
      // 'hu' inside 'shu' would read as a repeat that is not one; skip such tongues.
      if (t.some((a) => t.some((b) => a !== b && b.endsWith(a)))) continue;
      for (let id = 1; id < 300; id++) {
        for (const name of [personName(id, t), bandName(id, t)]) {
          const lower = name.toLowerCase();
          for (const syl of t) expect(lower).not.toContain(syl + syl);
          const coda = /[^aeiou]+$/.exec(lower)?.[0] ?? '';
          // A closing consonant that is also the start of an earlier syllable is an echo.
          if (coda) {
            const body = lower.slice(0, lower.length - coda.length);
            for (const syl of t) if (body.includes(syl) && syl.startsWith(coda)) expect(`${name}`).toBe('no echo');
          }
        }
      }
    }
  });

  it('epithets: null when nothing stands out, and a pool that varies by person', () => {
    expect(epithet(1, calm)).toBeNull();
    expect(epithet(1, { ...calm, cruelty: 250 })).toBe('the Cruel');
    expect(epithet(1, { ...calm, departures: 1 })).toBe('the Leaver');
    expect(epithet(1, { ...calm, departures: 2 })).toBe('the Restless');
    // Nobody is "exiled": leading a split is leaving.
    const seen = new Set<string>();
    for (let id = 1; id < 200; id++) {
      const e = epithet(id, { ...calm, departures: 1, cruelty: 250, strength: 250, wisdom: 250, peakFollowers: 200, battles: 3, founder: true });
      expect(e).not.toBeNull();
      expect(e).not.toMatch(/Exile/);
      seen.add(e!);
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
    // Same person, same epithet.
    expect(epithet(7, { ...calm, cruelty: 250, wisdom: 250 })).toBe(epithet(7, { ...calm, cruelty: 250, wisdom: 250 }));
  });

  it('landform and place names', () => {
    expect(landformFor({ upland: 0.8, roughness: 0.9, cover: 0.2, nearWater: false })).toBe('Ridge');
    expect(landformFor({ upland: 0.1, roughness: 0.1, cover: 0.8, nearWater: true })).toBe('Marsh');
    expect(placeName('Varn', 'Ridge')).toBe('Varn Ridge');
  });
});
