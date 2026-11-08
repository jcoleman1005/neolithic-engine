# Probes for the persistent-walk jitter work

**Status: shelved.** The wiring into `Rules.climb` and `life.ts` was reverted and `jitterEnabled` is `false`. To retry: `git apply scripts/probes/jitter-wiring.patch`, set `jitterEnabled: true`, and add `jitterEnabled: false` to the two off-switch parity tests (`tests/clash.test.ts`, `tests/drives-and-stages.test.ts`).

Throwaway analysis scripts, kept for the next iteration. Results are in `docs/findings.md` (sections "Jitter on vs off", "Why the jitter changed almost nothing", "Tile depletion under adults").

Run with `npx vite-node scripts/probes/<name>.ts <seed>`; use seeds 1 to 5, in parallel (4 cores), about 90 s each.

| File | Measures |
|---|---|
| `deplete.ts` | Per adult over 300 ticks after a 5-year warm-up, jitter off: stationary share, tile food fraction while staying, food change per stay tick, stay run lengths, whether a stay ends on a depleted tile, occupied vs unoccupied tile fullness |
| `jitter-gate.ts` | How many `climb` calls reach the jitter block, how many have weight 0, mean push vs mean pre-jitter velocity. **Needs the temporary counters below in `src/sim/rules.ts`; revert them afterwards (`git checkout src/sim/rules.ts`)** |

Baseline on/off movement comparison: `npm run movement -- --seed N --jitterEnabled true|false`. Null control: add `--jitterMinAmp 256`.

## Counters for `jitter-gate.ts`

At the top of `Rules.climb`, after `hOff` is set:

```ts
{ const G: any = (globalThis as any).__j; if (G) G.calls++; }
```

In the jitter block, after `const jd = jitterDir(j);`:

```ts
{ const G: any = (globalThis as any).__j; if (G) { G.reached++; const pre = Math.max(Math.abs(vx), Math.abs(vy));
  if (push === 0) G.zeroW++; G.pushSum += push; G.preSum += pre; if (pre < 0.05) G.preQuiet++;
  if (pre < 0.05 && push >= 0.05) G.jitterMoves++; if (pre >= 0.05 && push > pre) G.pushDominates++;
  if (pre >= 0.05 && push > 0 && push <= pre) G.pushMinor++; G.hist[Math.min(9, Math.floor(jitterWeight(j) * 10))]++; } }
```

## Ideas to try next (nothing agreed; see Parking lot in `docs/ROADMAP.md`)

1. Jitter: use the sum `(curiosity + roaming)` instead of the product, run it before the calm-stay return, and scale the push to the gradient (about 4.5).
2. Pressure to roam from the land, not from scripts (rule 4): slower `landRegrowthRate`, lower `landFoodMax`, seasonal swings in food. Re-run `deplete.ts` and look at unoccupied tile fullness (0.99 today) and the 90th percentile stay length.
3. Find out why about 35% of stay ticks are on tiles under the 0.5 stay fraction (leader pull, hut or heap value, thirst, cold).
4. Add worn-path share and settlement counts to the comparison (`movement.ts` lacks them), then do a watched run on the map (rule 13).
