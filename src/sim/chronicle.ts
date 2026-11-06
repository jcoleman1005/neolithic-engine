import type { World } from './world';
import type { WorldEventBody, ChronicleType } from './events';
import { BandTracker, type BandChange, type BandRecord } from './bands';
import { SettlementTracker, TIER_NAMES, type SettlementChange, type SettlementState, type SettlementView } from './settlements';
import { CLASH_RING, Rules } from './rules';
import { slotFromId, GENE_STRENGTH, GENE_CRUELTY, GENE_CHARISMA, GENE_WISDOM, GENE_BRAVERY, GENE_COUNT } from './people';
import {
  bandName, epithet, landformFor, makeTongue, personName, placeName, placeRoot, type EpithetFacts, type Tongue,
} from './naming';

/**
 * The chronicle: turns band changes, clash streaks and population swings into
 * short English entries. Read-only observer (Agent rule 11): it draws no random
 * numbers and changes no outcome. Names come from hashing ids only.
 */

const PRIORITY: Record<ChronicleType, number> = {
  battle: 4, split: 3, founded: 3, leaderDeath: 2, settled: 2, migration: 1, abandoned: 1, famine: 0, boom: 0,
};

/** What is remembered about a person who has led a band. */
export interface Notable extends EpithetFacts {
  readonly id: number;
  readonly bandKey: number;
  readonly died: boolean;
}

/** One running fight between two bands, closed when they have been quiet for a few days. */
interface PairState {
  a: number;
  b: number;
  clashes: number;
  winsA: number;
  winsB: number;
  fellA: number;
  fellB: number;
  firstTick: number;
  lastTick: number;
  sizeA: number;
  sizeB: number;
  tongueA: Tongue | null;
  tongueB: Tongue | null;
  x: number;
  y: number;
}

interface Mark {
  x: number;
  y: number;
  tick: number;
}

/** What the camera needs to know about a band. */
export interface BandView {
  readonly id: number;
  readonly name: string;
  readonly size: number;
  readonly cx: number;
  readonly cy: number;
  readonly foundedTick: number;
}

/** Plain-English lines about one person for the inspector. */
export interface PersonStory {
  readonly headline: string;
  readonly detail: string;
}

export interface ChronicleState {
  readonly bands: BandRecord[];
  readonly notables: Notable[];
  readonly pending: ReadonlyArray<readonly [number, 'split' | 'founded', number]>;
  readonly marks: ReadonlyArray<readonly [number, Mark]>;
  readonly populationWindow: ReadonlyArray<readonly [number, number]>;
  readonly lastFamine: number;
  readonly lastBoom: number;
  /** Absent in older saves. */
  readonly settlements?: SettlementState;
}

const NOTABLE_CAP = 512;

export class Chronicle {
  public readonly tracker = new BandTracker();
  public readonly settlements = new SettlementTracker();
  private readonly notables = new Map<number, Notable>();
  private readonly pairs = new Map<number, PairState>();
  /** When each pair last had a battle reported, for the cooldown. */
  private readonly lastBattle = new Map<number, number>();
  /** Bands waiting to reach an announcement size: band key -> [kind, tick it began]. */
  private readonly pending = new Map<number, { kind: 'split' | 'founded'; since: number }>();
  private readonly marks = new Map<number, Mark>();
  private populationWindow: Array<[number, number]> = [];
  private lastFamine = -Infinity;
  private lastBoom = -Infinity;
  private read = Rules.clashLog.head;

  /** Entries per type since this chronicle began, for tuning. */
  public readonly counts: Record<ChronicleType, number> = {
    battle: 0, split: 0, founded: 0, leaderDeath: 0, migration: 0, settled: 0, abandoned: 0, famine: 0, boom: 0,
  };

  public record(world: World): WorldEventBody[] {
    const config = world.config;
    const out: WorldEventBody[] = [];
    if (!(config.chronicleEnabled ?? true)) return out;

    this.closeFights(world, out);
    this.drainClashes(world);

    const changes = this.tracker.update(world);
    this.announceSettlements(
      world,
      this.settlements.update(world, this.tracker, (w, x, y, tongue, salt) => this.placeAt(w, x, y, tongue, salt)),
      out
    );
    if (world.tick % (config.bandTrackInterval ?? 60) !== 0) return out;

    this.noteLeaders(world);
    this.handleChanges(world, changes, out);
    this.announcePending(world, out);
    this.checkMigration(world, out);
    this.checkPopulation(world, out);
    this.prune(world);
    return out;
  }

  // ---- battles -----------------------------------------------------------

  /** Adds every new clash to the running fight between its two bands. */
  private drainClashes(world: World): void {
    const log = Rules.clashLog;
    if (log.head - this.read > CLASH_RING) this.read = log.head - CLASH_RING;
    const window = world.config.chronicleBattleWindow ?? 5;
    const tick = world.tick;

    for (; this.read < log.head; this.read++) {
      const i = this.read % CLASH_RING;
      const winner = log.winner[i];
      const loser = log.loser[i];
      const aWon = winner < loser;
      const lo = aWon ? winner : loser;
      const hi = aWon ? loser : winner;
      // Slots fit in 20 bits, so the pair fits in a double exactly.
      const key = slotFromId(lo) * 1048576 + slotFromId(hi);
      let p = this.pairs.get(key);
      if (p && (p.a !== lo || p.b !== hi || tick - p.lastTick > window)) {
        // A different pair on a reused slot, or a gap that should already have closed the fight.
        p = undefined;
      }
      if (!p) {
        p = {
          a: lo, b: hi, clashes: 0, winsA: 0, winsB: 0, fellA: 0, fellB: 0,
          firstTick: tick, lastTick: tick, sizeA: 0, sizeB: 0, tongueA: null, tongueB: null, x: 0, y: 0,
        };
        this.pairs.set(key, p);
      }
      p.clashes++;
      if (aWon) p.winsA++;
      else p.winsB++;
      if (log.fell[i] === 1) {
        if (aWon) p.fellB++;
        else p.fellA++;
      }
      p.lastTick = tick;
      p.x = log.x[i];
      p.y = log.y[i];
      const A = this.tracker.bands.get(lo);
      const B = this.tracker.bands.get(hi);
      if (A) { p.sizeA = A.size; p.tongueA = A.tongue; }
      if (B) { p.sizeB = B.size; p.tongueB = B.tongue; }
    }
  }

  /** A fight ends when the two bands have been quiet for a few days; only then is it reported. */
  private closeFights(world: World, out: WorldEventBody[]): void {
    if (this.pairs.size === 0) return;
    const config = world.config;
    const window = config.chronicleBattleWindow ?? 5;
    const need = config.chronicleBattleClashes ?? 14;
    const cooldown = config.chronicleBattleCooldown ?? 360;
    const minSize = config.chronicleBattleMinSize ?? 20;
    const tick = world.tick;

    for (const [key, p] of this.pairs) {
      if (tick - p.lastTick <= window) continue;
      this.pairs.delete(key);
      if (p.clashes < need || p.sizeA < minSize || p.sizeB < minSize || !p.tongueA || !p.tongueB) continue;
      const lastReport = this.lastBattle.get(key);
      if (lastReport !== undefined && tick - lastReport < cooldown) continue;
      this.lastBattle.set(key, tick);
      out.push(this.battleEntry(world, p));
    }
  }

  private battleEntry(world: World, p: PairState): WorldEventBody {
    const config = world.config;
    const kind = p.clashes >= (config.chronicleGreatBattleSize ?? 250) ? 'Great battle'
      : p.clashes >= (config.chronicleBattleSize ?? 60) ? 'Battle' : 'Skirmish';
    const nameA = bandName(p.a, p.tongueA!);
    const nameB = bandName(p.b, p.tongueB!);
    const days = p.lastTick - p.firstTick + 1;
    const fell = p.fellA + p.fellB;
    const margin = Math.abs(p.winsA - p.winsB);
    let outcome: string;
    if (margin * 10 < p.clashes) {
      outcome = `neither the ${nameA} nor the ${nameB} gave way`;
    } else if (p.winsA > p.winsB) {
      outcome = `the ${nameA} beat the ${nameB}`;
    } else {
      outcome = `the ${nameB} beat the ${nameA}`;
    }
    const toll = fell === 0 ? 'driven off without fatalities'
      : `${fell} fell (${p.fellA} of the ${nameA}, ${p.fellB} of the ${nameB})`;
    const place = this.placeAt(world, p.x, p.y, p.tongueA!);
    const text = `${kind} near ${place}: ${outcome} after ${days} ${days === 1 ? 'day' : 'days'}, ${p.clashes} clashes, ${toll}`;
    // Both leaders carry the battle into their epithets.
    for (const id of [p.a, p.b]) {
      const n = this.notables.get(id);
      if (n) this.notables.set(id, { ...n, battles: (n.battles ?? 0) + 1 });
    }
    return this.entry('battle', text, p.x, p.y, p.winsA >= p.winsB ? p.a : p.b);
  }

  // ---- bands -------------------------------------------------------------

  private noteLeaders(world: World): void {
    const people = world.people;
    const ticksPerYear = world.config.ticksPerYear || 360;
    for (const band of this.tracker.bands.values()) {
      const s = slotFromId(band.id);
      if (s >= people.capacity || people.alive[s] === 0 || people.idOf(s) !== band.id) continue;
      const g = s * GENE_COUNT;
      const prev = this.notables.get(band.id);
      this.notables.set(band.id, {
        id: band.id,
        bandKey: band.id,
        died: false,
        strength: people.genes[g + GENE_STRENGTH],
        cruelty: people.genes[g + GENE_CRUELTY],
        charisma: people.genes[g + GENE_CHARISMA],
        wisdom: people.genes[g + GENE_WISDOM],
        bravery: people.genes[g + GENE_BRAVERY],
        departures: prev?.departures ?? 0,
        battles: prev?.battles ?? 0,
        founder: prev?.founder ?? false,
        peakFollowers: Math.max(prev?.peakFollowers ?? 0, band.size - 1),
        ageYears: people.age[s] / ticksPerYear,
      });
    }
  }

  private handleChanges(world: World, changes: BandChange[], out: WorldEventBody[]): void {
    const minFollowers = world.config.chronicleLeaderMinFollowers ?? 20;
    for (const c of changes) {
      if (c.kind === 'split') {
        this.pending.set(c.band, { kind: 'split', since: world.tick });
        const n = this.notables.get(c.band);
        // The leader of a split leaves with their followers; nobody is exiled.
        if (n) this.notables.set(c.band, { ...n, departures: n.departures + 1 });
      } else if (c.kind === 'founded') {
        this.pending.set(c.band, { kind: 'founded', since: world.tick });
        const n = this.notables.get(c.band);
        if (n) this.notables.set(c.band, { ...n, founder: true });
      } else if (c.kind === 'succession') {
        const rec = this.tracker.bands.get(c.band);
        const old = this.notables.get(c.from);
        if (old) {
          this.notables.set(c.from, { ...old, died: true });
          this.moveMarkAndPending(c.from, c.band);
          if (rec && old.peakFollowers >= minFollowers && rec.size >= minFollowers) {
            out.push(this.entry('leaderDeath',
              `${this.titled(old, rec)} has died; ${personName(c.band, rec.tongue)} now leads the ${bandName(c.band, rec.tongue)} (${rec.size} people)`,
              rec.cx, rec.cy, rec.id));
          }
        }
      } else if (c.kind === 'died') {
        const old = this.notables.get(c.band);
        this.pending.delete(c.band);
        this.marks.delete(c.band);
        if (old) {
          this.notables.set(c.band, { ...old, died: true });
          if (c.lastSize >= minFollowers) {
            const rec = c.record;
            out.push(this.entry('leaderDeath',
              `${this.titled(old, rec)} is gone and the ${bandName(rec.id, rec.tongue)} scatter (last count ${c.lastSize})`,
              rec.cx, rec.cy, rec.id));
          }
        }
      }
    }
  }

  private moveMarkAndPending(from: number, to: number): void {
    const m = this.marks.get(from);
    if (m) {
      this.marks.delete(from);
      this.marks.set(to, m);
    }
    const p = this.pending.get(from);
    if (p) {
      this.pending.delete(from);
      this.pending.set(to, p);
    }
  }

  private announcePending(world: World, out: WorldEventBody[]): void {
    const config = world.config;
    const splitMin = config.chronicleSplitMinSize ?? 20;
    const foundMin = config.chronicleFoundMinSize ?? 40;
    const ticksPerYear = config.ticksPerYear || 360;
    for (const [key, p] of this.pending) {
      const rec = this.tracker.bands.get(key);
      if (!rec || world.tick - p.since > 2 * ticksPerYear) {
        this.pending.delete(key);
        continue;
      }
      const need = p.kind === 'split' ? splitMin : foundMin;
      if (rec.size < need) continue;
      this.pending.delete(key);
      const parent = this.tracker.bands.get(rec.parentId);
      const leader = this.notables.get(key);
      const name = leader ? this.titled(leader, rec) : `the ${bandName(rec.id, rec.tongue)}`;
      const place = this.placeAt(world, rec.cx, rec.cy, rec.tongue);
      if (p.kind === 'split' && parent) {
        out.push(this.entry('split',
          `${name} leads ${rec.size} people away from the ${bandName(parent.id, parent.tongue)} to ${place}`,
          rec.cx, rec.cy, rec.id));
      } else {
        out.push(this.entry('founded',
          `${name} gathers a new band of ${rec.size} at ${place}`, rec.cx, rec.cy, rec.id));
      }
    }
  }

  private checkMigration(world: World, out: WorldEventBody[]): void {
    const config = world.config;
    const dist = config.chronicleMigrationDistance ?? 60;
    const window = config.chronicleMigrationWindow ?? 720;
    const minSize = config.chronicleBattleMinSize ?? 20;
    const size = world.land.width;
    for (const rec of this.tracker.bands.values()) {
      if (rec.size < minSize) continue;
      const m = this.marks.get(rec.id);
      if (!m) {
        this.marks.set(rec.id, { x: rec.cx, y: rec.cy, tick: world.tick });
        continue;
      }
      const dx = wrap(rec.cx - m.x, size);
      const dy = wrap(rec.cy - m.y, size);
      if (Math.hypot(dx, dy) >= dist) {
        const from = this.placeAt(world, m.x, m.y, rec.tongue);
        const to = this.placeAt(world, rec.cx, rec.cy, rec.tongue);
        out.push(this.entry('migration',
          `The ${bandName(rec.id, rec.tongue)} (${rec.size}) leave ${from} and settle near ${to}`, rec.cx, rec.cy, rec.id));
        this.marks.set(rec.id, { x: rec.cx, y: rec.cy, tick: world.tick });
      } else if (world.tick - m.tick >= window) {
        this.marks.set(rec.id, { x: rec.cx, y: rec.cy, tick: world.tick });
      }
    }
  }

  // ---- population --------------------------------------------------------

  private checkPopulation(world: World, out: WorldEventBody[]): void {
    const config = world.config;
    const ticksPerYear = config.ticksPerYear || 360;
    const span = (config.chronicleWindowYears ?? 1) * ticksPerYear;
    const cooldown = (config.chronicleCooldownYears ?? 5) * ticksPerYear;
    const pop = world.population;
    this.populationWindow.push([world.tick, pop]);
    while (this.populationWindow.length > 0 && world.tick - this.populationWindow[0][0] > span) {
      this.populationWindow.shift();
    }
    let hi = pop;
    let lo = pop;
    for (const [, p] of this.populationWindow) {
      if (p > hi) hi = p;
      if (p < lo) lo = p;
    }
    const first = this.populationWindow[0]?.[1] ?? pop;
    if (hi >= 100 && (hi - pop) / hi >= (config.chronicleFamineDrop ?? 0.15) && world.tick - this.lastFamine >= cooldown) {
      this.lastFamine = world.tick;
      out.push(this.entry('famine', `Famine: the people thin from ${hi} to ${pop}`, -1, -1, 0));
    } else if (first >= 100 && (pop - first) / first >= (config.chronicleBoomRise ?? 0.3) && world.tick - this.lastBoom >= cooldown) {
      this.lastBoom = world.tick;
      out.push(this.entry('boom', `Boom: the people grow from ${first} to ${pop}`, -1, -1, 0));
    }
  }

  // ---- views -------------------------------------------------------------

  /** Bands of at least `minSize` people, biggest first, capped for the wire. */
  /** Hamlets and larger get entries; camps come and go too often to report. */
  private announceSettlements(world: World, changes: SettlementChange[], out: WorldEventBody[]): void {
    const minTier = world.config.settlementAnnounceTier ?? 1;
    for (const c of changes) {
      const r = c.record;
      if (r.peakTier < minTier) continue;
      if (c.kind === 'rose') {
        const text = r.tier === 1
          ? `A hamlet takes root at ${r.name}`
          : `${r.name} grows into a ${TIER_NAMES[r.tier]} of ${Math.round(r.residents)} people`;
        out.push(this.entry('settled', text, r.x, r.y, 0));
      } else if (c.kind === 'abandoned') {
        const years = Math.round((r.lastQualified - r.foundedTick) / (world.config.ticksPerYear || 360));
        out.push(this.entry('abandoned', `${r.name}, once a ${TIER_NAMES[r.peakTier]}, stands empty after ${years} years`, r.x, r.y, 0));
      } else {
        out.push(this.entry('abandoned', `${r.name} is swallowed by ${c.into.name}`, r.x, r.y, 0));
      }
    }
  }

  public settlementViews(): SettlementView[] {
    return this.settlements.views();
  }

  public bandViews(minSize: number, cap = 64): BandView[] {
    const out: BandView[] = [];
    for (const b of this.tracker.bands.values()) {
      if (b.size >= minSize) {
        out.push({ id: b.id, name: bandName(b.id, b.tongue), size: b.size, cx: b.cx, cy: b.cy, foundedTick: b.foundedTick });
      }
    }
    out.sort((a, b) => b.size - a.size || a.id - b.id);
    return out.slice(0, cap);
  }

  public describePerson(
    world: World,
    p: { id: number; x: number; y: number; motherId: number; rootLeaderId?: number }
  ): PersonStory {
    const root = p.rootLeaderId || p.id;
    const band = this.tracker.bands.get(root);
    const tongue: Tongue = band ? band.tongue : makeTongue(p.motherId || p.id);
    const place = this.placeAt(world, p.x, p.y, tongue);
    const nameOf = (id: number): string => {
      const n = this.notables.get(id);
      const ep = n ? epithet(id, n) : null;
      return `${personName(id, tongue)}${ep ? ` ${ep}` : ''}`;
    };
    if (!band) {
      return { headline: nameOf(p.id), detail: `Belongs to no large band and wanders near ${place}.` };
    }
    const bn = bandName(band.id, tongue);
    if (root === p.id) {
      return { headline: `${nameOf(p.id)} of the ${bn}`, detail: `Leads ${band.size - 1} followers near ${place}.` };
    }
    return {
      headline: `${nameOf(p.id)} of the ${bn}`,
      detail: `Follows ${nameOf(root)}, with ${Math.max(0, band.size - 2)} others, near ${place}.`,
    };
  }

  // ---- helpers -----------------------------------------------------------

  private prune(world: World): void {
    const cooldown = world.config.chronicleBattleCooldown ?? 360;
    for (const [k, t] of this.lastBattle) if (world.tick - t >= cooldown) this.lastBattle.delete(k);
    if (this.notables.size > NOTABLE_CAP) {
      const dead = [...this.notables.values()].filter((n) => n.died).sort((a, b) => a.peakFollowers - b.peakFollowers);
      for (const n of dead) {
        if (this.notables.size <= NOTABLE_CAP) break;
        this.notables.delete(n.id);
      }
    }
  }

  /** "Kesh the Cruel of the Varn". */
  private titled(n: Notable, rec: BandRecord): string {
    const ep = epithet(n.id, n);
    return `${personName(n.id, rec.tongue)}${ep ? ` ${ep}` : ''} of the ${bandName(rec.id, rec.tongue)}`;
  }

  private placeAt(world: World, x: number, y: number, tongue: Tongue, salt = 0): string {
    const cx = Math.max(0, Math.min(world.land.width - 1, Math.round(x)));
    const cy = Math.max(0, Math.min(world.land.height - 1, Math.round(y)));
    const elev = world.land.elevation;
    const terrain = world.land.terrain;
    const index = cy * world.land.width + cx;
    let nearWater = false;
    for (let dy = -2; dy <= 2 && !nearWater; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (world.land.isWaterAt((cx + dx + world.land.width) % world.land.width, (cy + dy + world.land.height) % world.land.height)) {
          nearWater = true;
          break;
        }
      }
    }
    const land = landformFor({
      upland: elev ? elev.upland01(index) : 0,
      roughness: terrain ? terrain.roughnessAt(cx, cy) : 0,
      cover: terrain ? terrain.coverAt(cx, cy) : 0,
      nearWater,
    });
    // The place takes a root word from the band's tongue and the 16-cell block it lies in.
    return placeName(placeRoot((cx >> 4) * 64 + (cy >> 4) + salt * 4099, tongue), land);
  }

  private entry(type: ChronicleType, text: string, x: number, y: number, band: number): WorldEventBody {
    this.counts[type]++;
    return { kind: 'chronicle', type, text, priority: PRIORITY[type], x, y, band };
  }

  // ---- save --------------------------------------------------------------

  public exportState(): ChronicleState {
    return {
      bands: this.tracker.exportState(),
      notables: Array.from(this.notables.values()),
      pending: Array.from(this.pending, ([k, v]) => [k, v.kind, v.since] as const),
      marks: Array.from(this.marks),
      populationWindow: this.populationWindow.map(([t, p]) => [t, p] as const),
      lastFamine: Number.isFinite(this.lastFamine) ? this.lastFamine : -1e12,
      lastBoom: Number.isFinite(this.lastBoom) ? this.lastBoom : -1e12,
      settlements: this.settlements.exportState(),
    };
  }

  public importState(state: ChronicleState): void {
    this.tracker.importState(state.bands);
    this.notables.clear();
    for (const n of state.notables) {
      // Older saves counted departures as "exiles".
      const legacy = (n as unknown as { exiles?: number }).exiles;
      this.notables.set(n.id, { ...n, departures: n.departures ?? legacy ?? 0, battles: n.battles ?? 0, founder: n.founder ?? false });
    }
    this.pending.clear();
    for (const [k, kind, since] of state.pending) this.pending.set(k, { kind, since });
    this.marks.clear();
    for (const [k, m] of state.marks) this.marks.set(k, { ...m });
    this.populationWindow = state.populationWindow.map(([t, p]) => [t, p]);
    this.lastFamine = state.lastFamine;
    this.lastBoom = state.lastBoom;
    if (state.settlements) this.settlements.importState(state.settlements);
    this.read = Rules.clashLog.head;
  }
}

function wrap(d: number, size: number): number {
  if (d > size / 2) return d - size;
  if (d < -size / 2) return d + size;
  return d;
}
