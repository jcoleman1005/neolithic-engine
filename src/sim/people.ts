export const INITIAL_PEOPLE_CAPACITY = 2048;
export const SLOT_MASK = 0xfffff; // 20 bits: up to 1,048,575 slots
export const GEN_MASK = 0xfff; // 12 bits: 0..4095

export function makePersonId(slot: number, slotGen: number): number {
  return (((slot & SLOT_MASK) << 12) | (slotGen & GEN_MASK)) >>> 0;
}

export function slotFromId(id: number): number {
  return (id >>> 12) & SLOT_MASK;
}

export function genFromId(id: number): number {
  return id & GEN_MASK;
}

export interface PackedPerson {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly energy: number;
  readonly sex: number;
  readonly age: number;
  readonly generation: number;
  readonly pregnant: number;
  readonly mateId: number;
  readonly motherId: number;
  readonly fatherId: number;
}

export interface PeopleState {
  readonly capacity: number;
  readonly count: number;
  readonly slotGenerations: readonly number[];
  readonly freeList?: readonly number[];
  readonly people: readonly PackedPerson[];
}

export class People {
  public capacity: number;
  public count = 0;

  public alive: Uint8Array;
  public slotGenerations: Uint16Array;
  public x: Uint8Array;
  public y: Uint8Array;
  public energy: Float32Array;
  public sex: Uint8Array; // 0 = female, 1 = male
  public age: Uint32Array;
  public generation: Uint16Array;
  public pregnant: Int16Array; // -1 = none, >= 0 = ticks elapsed
  public mateId: Uint32Array;
  public motherId: Uint32Array;
  public fatherId: Uint32Array;

  public freeList: Int32Array;
  public freeCount = 0;

  constructor(initialCapacity = INITIAL_PEOPLE_CAPACITY) {
    this.capacity = initialCapacity;
    this.alive = new Uint8Array(this.capacity);
    this.slotGenerations = new Uint16Array(this.capacity);
    this.x = new Uint8Array(this.capacity);
    this.y = new Uint8Array(this.capacity);
    this.energy = new Float32Array(this.capacity);
    this.sex = new Uint8Array(this.capacity);
    this.age = new Uint32Array(this.capacity);
    this.generation = new Uint16Array(this.capacity);
    this.pregnant = new Int16Array(this.capacity);
    this.mateId = new Uint32Array(this.capacity);
    this.motherId = new Uint32Array(this.capacity);
    this.fatherId = new Uint32Array(this.capacity);

    this.freeList = new Int32Array(this.capacity);
    this.initFreeList(0, this.capacity);
  }

  private initFreeList(start: number, end: number): void {
    for (let i = start; i < end; i++) {
      this.freeList[this.freeCount++] = i;
      this.pregnant[i] = -1;
      this.mateId[i] = 0;
    }
  }

  public grow(): void {
    const oldCap = this.capacity;
    const newCap = oldCap * 2;

    const copyU8 = (old: Uint8Array) => {
      const n = new Uint8Array(newCap);
      n.set(old);
      return n;
    };
    const copyU16 = (old: Uint16Array) => {
      const n = new Uint16Array(newCap);
      n.set(old);
      return n;
    };
    const copyU32 = (old: Uint32Array) => {
      const n = new Uint32Array(newCap);
      n.set(old);
      return n;
    };
    const copyI16 = (old: Int16Array) => {
      const n = new Int16Array(newCap);
      n.set(old);
      return n;
    };
    const copyF32 = (old: Float32Array) => {
      const n = new Float32Array(newCap);
      n.set(old);
      return n;
    };

    this.alive = copyU8(this.alive);
    this.slotGenerations = copyU16(this.slotGenerations);
    this.x = copyU8(this.x);
    this.y = copyU8(this.y);
    this.energy = copyF32(this.energy);
    this.sex = copyU8(this.sex);
    this.age = copyU32(this.age);
    this.generation = copyU16(this.generation);
    this.pregnant = copyI16(this.pregnant);
    this.mateId = copyU32(this.mateId);
    this.motherId = copyU32(this.motherId);
    this.fatherId = copyU32(this.fatherId);

    const newFreeList = new Int32Array(newCap);
    newFreeList.set(this.freeList.subarray(0, this.freeCount));
    this.freeList = newFreeList;

    this.capacity = newCap;
    this.initFreeList(oldCap, newCap);
  }

  public spawn(
    x: number,
    y: number,
    energy: number,
    sex: number,
    generation = 0,
    motherId = 0,
    fatherId = 0
  ): number {
    if (this.freeCount === 0) {
      this.grow();
    }

    const slot = this.freeList[--this.freeCount];
    const slotGen = (this.slotGenerations[slot] + 1) & GEN_MASK;
    this.slotGenerations[slot] = slotGen;

    this.alive[slot] = 1;
    this.x[slot] = x & 0xff;
    this.y[slot] = y & 0xff;
    this.energy[slot] = energy;
    this.sex[slot] = sex & 1;
    this.age[slot] = 0;
    this.generation[slot] = generation;
    this.pregnant[slot] = -1;
    this.mateId[slot] = 0;
    this.motherId[slot] = motherId;
    this.fatherId[slot] = fatherId;

    this.count++;
    return makePersonId(slot, slotGen);
  }

  public kill(slot: number): void {
    if (this.alive[slot] === 0) return;
    this.alive[slot] = 0;
    this.freeList[this.freeCount++] = slot;
    this.count--;
  }

  public idOf(slot: number): number {
    return makePersonId(slot, this.slotGenerations[slot]);
  }

  public isValidId(id: number): boolean {
    const slot = slotFromId(id);
    if (slot >= this.capacity || this.alive[slot] === 0) return false;
    return (this.slotGenerations[slot] & GEN_MASK) === genFromId(id);
  }

  public totalEnergy(): number {
    let sum = 0;
    for (let i = 0; i < this.capacity; i++) {
      if (this.alive[i] === 1) {
        sum += this.energy[i];
      }
    }
    return sum;
  }

  public exportState(): PeopleState {
    const people: PackedPerson[] = [];
    for (let slot = 0; slot < this.capacity; slot++) {
      if (this.alive[slot] === 1) {
        people.push({
          id: this.idOf(slot),
          x: this.x[slot],
          y: this.y[slot],
          energy: this.energy[slot],
          sex: this.sex[slot],
          age: this.age[slot],
          generation: this.generation[slot],
          pregnant: this.pregnant[slot],
          mateId: this.mateId[slot],
          motherId: this.motherId[slot],
          fatherId: this.fatherId[slot],
        });
      }
    }

    return {
      capacity: this.capacity,
      count: this.count,
      slotGenerations: Array.from(this.slotGenerations),
      freeList: Array.from(this.freeList.subarray(0, this.freeCount)),
      people,
    };
  }

  public importState(state: PeopleState): void {
    const targetCap = Math.max(INITIAL_PEOPLE_CAPACITY, state.capacity);
    // Expand arrays FIRST before setting this.capacity so growTo actually grows
    this.growTo(targetCap);
    this.capacity = targetCap;

    this.alive.fill(0);
    this.freeCount = 0;
    this.count = 0;

    // Restore slot generation sequence
    const genLen = Math.min(this.slotGenerations.length, state.slotGenerations.length);
    for (let i = 0; i < genLen; i++) {
      this.slotGenerations[i] = state.slotGenerations[i];
    }

    const occupied = new Set<number>();
    for (const p of state.people) {
      const slot = slotFromId(p.id);
      if (slot >= this.capacity) continue;
      this.alive[slot] = 1;
      this.slotGenerations[slot] = genFromId(p.id);
      this.x[slot] = p.x;
      this.y[slot] = p.y;
      this.energy[slot] = p.energy;
      this.sex[slot] = p.sex;
      this.age[slot] = p.age;
      this.generation[slot] = p.generation;
      this.pregnant[slot] = p.pregnant;
      this.mateId[slot] = p.mateId ?? (p as any).mateSlot ?? 0;
      this.motherId[slot] = p.motherId;
      this.fatherId[slot] = p.fatherId;
      occupied.add(slot);
      this.count++;
    }

    // Restore free-list order exactly if saved, or reconstruct
    if (state.freeList && Array.isArray(state.freeList) && state.freeList.length > 0) {
      this.freeCount = state.freeList.length;
      for (let i = 0; i < state.freeList.length; i++) {
        const slot = state.freeList[i];
        this.freeList[i] = slot;
        if (slot < this.capacity) {
          this.pregnant[slot] = -1;
          this.mateId[slot] = 0;
        }
      }
    } else {
      // Reconstruct freeList for unoccupied slots
      for (let i = 0; i < this.capacity; i++) {
        if (!occupied.has(i)) {
          this.freeList[this.freeCount++] = i;
          this.pregnant[i] = -1;
          this.mateId[i] = 0;
        }
      }
    }
  }

  private growTo(newCap: number): void {
    while (this.capacity < newCap) {
      this.grow();
    }
  }
}
