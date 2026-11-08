import { describe, expect, it } from 'vitest';
import { awayHTML, readLastSeen, summariseAway, writeLastSeen } from '../src/ui/away-view';
import type { WorldEvent } from '../src/sim/events';
import { Chronicle } from '../src/sim/chronicle';
import { World } from '../src/sim/world';

const entry = (seq: number, tick: number, priority: number, text = `entry ${seq}`): WorldEvent => ({
  seq, tick, kind: 'chronicle', type: 'battle', text, priority, x: 1, y: 1, band: 1,
});

describe('Phase 4c while you were away', () => {
  it('shows only entries newer than the last one seen', () => {
    const events = [entry(1, 100, 3), entry(2, 200, 4), entry(3, 3000, 2)];
    const s = summariseAway(events, { seq: 1, tick: 100 }, 360)!;
    expect(s.entries.map((e) => e.text)).toEqual(['entry 2', 'entry 3']);
    expect(s.years).toBe(8);
    expect(s.more).toBe(0);
  });

  it('says nothing on a first visit, when nothing new happened, or for a different world', () => {
    const events = [entry(5, 500, 3)];
    expect(summariseAway(events, null, 360)).toBeNull();
    expect(summariseAway(events, { seq: 5, tick: 500 }, 360)).toBeNull();
    expect(summariseAway(events, { seq: 9, tick: 900 }, 360)).toBeNull();
    expect(summariseAway(events, { seq: 2, tick: 9000 }, 360)).toBeNull();
    expect(summariseAway([], { seq: 1, tick: 1 }, 360)).toBeNull();
  });

  it('keeps the card short: the most important entries, in the order they happened', () => {
    const events = Array.from({ length: 20 }, (_, i) => entry(i + 2, 100 + i, i === 3 ? 4 : 1));
    const s = summariseAway(events, { seq: 1, tick: 50 }, 360)!;
    expect(s.entries).toHaveLength(8);
    expect(s.more).toBe(12);
    expect(s.entries.map((e) => e.tick)).toEqual([...s.entries.map((e) => e.tick)].sort((a, b) => a - b));
    expect(s.entries.some((e) => e.priority === 4)).toBe(true);
  });

  it('escapes entry text in the card', () => {
    const s = summariseAway([entry(2, 200, 3, '<b>x</b> & y')], { seq: 1, tick: 100 }, 360)!;
    const html = awayHTML(s);
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt; &amp; y');
  });

  it('remembers what was seen, and survives storage that throws', () => {
    const map = new Map<string, string>();
    const store = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
    writeLastSeen(store, { seq: 7, tick: 123 });
    expect(readLastSeen(store)).toEqual({ seq: 7, tick: 123 });
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(readLastSeen(broken)).toBeNull();
    expect(() => writeLastSeen(broken, { seq: 1, tick: 1 })).not.toThrow();
    expect(readLastSeen(null)).toBeNull();
  });
});

describe('Phase 4c inspector story', () => {
  it('describes a person in plain English and is the same twice', async () => {
    const world = new World({ initialPopulation: 300 }, 7);
    const chronicle = new Chronicle();
    for (let i = 0; i < 2400; i++) {
      world.step();
      if (i % 200 === 0) await new Promise((r) => setImmediate(r));
      chronicle.record(world);
    }
    const people = world.people;
    let leader = -1;
    let follower = -1;
    for (let s = 0; s < people.capacity; s++) {
      if (people.alive[s] === 0) continue;
      const id = people.idOf(s);
      const root = people.rootLeaderId[s] || id;
      if (!chronicle.tracker.bands.has(root)) continue;
      if (root === id && leader < 0) leader = s;
      if (root !== id && follower < 0) follower = s;
    }
    expect(leader).toBeGreaterThanOrEqual(0);
    expect(follower).toBeGreaterThanOrEqual(0);
    const info = (s: number) => ({ id: people.idOf(s), x: people.x[s], y: people.y[s], motherId: people.motherId[s], rootLeaderId: people.rootLeaderId[s] });
    const a = chronicle.describePerson(world, info(leader));
    expect(chronicle.describePerson(world, info(leader))).toEqual(a);
    expect(a.detail).toMatch(/^Leads \d+ followers near .+\.$/);
    expect(chronicle.describePerson(world, info(follower)).detail).toMatch(/^Follows .+, with \d+ others, near .+\.$/);
    expect(chronicle.describePerson(world, info(follower)).headline).toMatch(/ of the /);
  }, 120000);
});
