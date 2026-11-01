# Neolithic Engine — Findings

## Parameter Log

Record every tuned value, old and new, and the reason for the change here.

| Date | Parameter | Old | New | Why |
| --- | --- | --- | --- | --- |
| 2026-10-31 | `worldWidth` | 60 | 256 | Phase 0 256×256 wrapped grid specification |
| 2026-10-31 | `worldHeight` | 60 | 256 | Phase 0 256×256 wrapped grid specification |
| 2026-10-31 | `wrapping` | false | true | Phase 0 wrapped world edges |
| 2026-10-31 | `ticksPerYear` | 400 | 360 | Phase 0 calendar specification (360 ticks per year) |
| 2026-11-01 | `initialPopulation` | 0 | 1000 | Phase 1 founder population size |
| 2026-11-01 | `initialEnergy` | 0 | 50.0 | Phase 1 founder initial energy endowment |
| 2026-11-01 | `maxEnergy` | 0 | 100.0 | Phase 1 maximum energy capacity |
| 2026-11-01 | `metabolismCost` | 0 | 0.25 | Phase 1 base daily living cost per person |
| 2026-11-01 | `moveCost` | 0 | 0.05 | Phase 1 daily movement exertion |
| 2026-11-01 | `forageBite` | 0 | 1.0 | Phase 1 max daily grazing yield |
| 2026-11-01 | `landFoodMax` | 0 | 25.0 | Phase 1 base cell plant food carrying capacity |
| 2026-11-01 | `landRegrowthRate` | 0 | 0.05 | Phase 1 logistic regrowth constant |
| 2026-11-01 | `landGrazingFloor` | 0 | 1.0 | Phase 1 reserve floor below which plants cannot be grazed |
| 2026-11-01 | `adultAge` | 0 | 5760 | Phase 1 age of sexual maturity (16 years = 5,760 ticks) |
| 2026-11-01 | `maxAge` | 0 | 21600 | Phase 1 natural lifespan limit (60 years = 21,600 ticks) |
| 2026-11-01 | `reproductionThreshold` | 0 | 65.0 | Phase 1 energy threshold to initiate reproduction |
| 2026-11-01 | `childEnergy` | 0 | 30.0 | Phase 1 energy transferred to newborn child |
| 2026-11-01 | `birthTax` | 0 | 5.0 | Phase 1 energy cost of gestation and labor |
| 2026-11-01 | `gestationTicks` | 0 | 270 | Phase 1 pregnancy duration (9 months = 270 ticks) |
| 2026-11-01 | `matingRadius` | 0 | 2 | Phase 1 mate search radius in wrapped cells |

## Experiment Log
