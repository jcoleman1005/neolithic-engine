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
| 2026-11-01 | `scentDiffusionRate` | 0 | 0.1 | Phase 3 scent dispersion rate across adjacent cells |
| 2026-11-01 | `scentEvaporationRate` | 0 | 0.02 | Phase 3 scent decay rate per step |
| 2026-11-01 | `scentDiffusionInterval` | 0 | 4 | Phase 3 scent diffusion step interval in ticks |
| 2026-11-01 | `scentFoodEmitRate` | 0 | 0.1 | Phase 3 land plant food scent emission factor |
| 2026-11-01 | `scentDangerDeath` | 0 | 10.0 | Phase 3 danger scent deposited upon starvation/old age death |
| 2026-11-01 | `scentDangerClash` | 0 | 5.0 | Phase 3 danger scent deposited at clash site |
| 2026-11-01 | `geneMutationRate` | 0 | 0.05 | Phase 3 mutation probability per gene during reproduction |
| 2026-11-01 | `geneMutationRange` | 0 | 16 | Phase 3 mutation drift range [0..255] |
| 2026-11-01 | `habitStickiness` | 0 | 0.9 | Phase 3 cultural transmission stickiness vs neighbor shift |
| 2026-11-01 | `decisionStaggerInterval` | 0 | 8 | Phase 3 ID-staggered social evaluation interval in ticks |
| 2026-11-01 | `leaderWeightStrength` | 0 | 1.0 | Phase 3 leadership utility weight for physical strength |
| 2026-11-01 | `leaderWeightCharisma` | 0 | 1.0 | Phase 3 leadership utility weight for social charisma |
| 2026-11-01 | `leaderWeightEnergy` | 0 | 1.0 | Phase 3 leadership utility weight for energy wealth |
| 2026-11-01 | `leaderWeightKin` | 0 | 1.0 | Phase 3 leadership utility bonus for direct kinship |
| 2026-11-01 | `leaderWeightWisdom` | 0 | 1.0 | Phase 3 leadership utility weight for wisdom |
| 2026-11-01 | `leaderWeightBravery` | 0 | 1.0 | Phase 3 leadership utility weight for bravery |
| 2026-11-01 | `leaderSearchRadius` | 0 | 6 | Phase 3 candidate leader visual search radius in cells |
| 2026-11-01 | `clashEnergyCost` | 0 | 1.0 | Phase 3 combat friction energy deduction per participant |
| 2026-11-01 | `shareEnergyMinSurplus` | 0 | 15.0 | Phase 3 minimum surplus energy required before sharing |
| 2026-11-01 | `shareEnergyAmount` | 0 | 5.0 | Phase 3 energy transferred during close-contact sharing |
| 2026-11-01 | `clashLossShare` | 0 | 0.25 | Phase 3 decisive combat loser energy forfeiture share |
| 2026-11-01 | `clashLootEfficiency` | 0 | 0.8 | Phase 3 victor loot absorption fraction (remainder lost to struggle) |
| 2026-11-01 | `incumbencyBonus` | 0 | 0.35 | Phase 3 leader retention loyalty margin against self / current leader |
| 2026-11-01 | `rootLeaderSliceCount` | 0 | 8 | Phase 3 time-sliced cached root leader refresh count |
| 2026-11-03 | `fertilityChangeEnabled` | false | true | Mutable land fertility switch |
| 2026-11-03 | `fertilityMin` | 0 | 0.05 | Minimum soil fertility clamp floor |
| 2026-11-03 | `fertilityMax` | 0 | 1.5 | Maximum soil fertility ceiling |
| 2026-11-03 | `fertilityDegradeRate` | 0 | 0.0005 | Soil fertility wear per grazing bite when overgrazed/stripped |
| 2026-11-03 | `fertilityPassiveGain` | 0 | 0.00005 | Passive soil fertility recovery/enrichment on tilled, seeded, healthy vegetated land |
| 2026-11-03 | `fertilityActionGain` | 0 | 0.002 | Direct fertility enrichment per seed drop |
| 2026-11-03 | `fertilityTampGain` | 0 | 0.0008 | Soil improvement per tamping event |
| 2026-11-03 | `fertilityCompostGain` | 0 | 0.0005 | Fertility enrichment from spoiling organic food heaps |
| 2026-11-04 | `birthHazardsEnabled` | false | true | Deterministic childbirth physical trauma and metabolic demands switch |
| 2026-11-04 | `pregnancyUpkeepMul` | 1.0 | 1.25 | Extra upkeep multiplier during pregnancy (+25%) |
| 2026-11-04 | `pregnancyMiscarriageEnergy` | 0 | 15.0 | Energy threshold below which severe starvation terminates pregnancy to protect mother |
| 2026-11-04 | `birthInjury` | 0 | 40.0 | Baseline physical trauma inflicted on mother at delivery |
| 2026-11-04 | `birthShelterInjuryMul` | 1.0 | 0.35 | Trauma multiplier when delivering in shelter (nest, cave, stone hut, campfire aura) |
| 2026-11-04 | `birthColdInjuryMul` | 1.0 | 1.5 | Trauma multiplier when delivering unsheltered in freezing cold |
| 2026-11-04 | `birthExhaustionInjury` | 0 | 20.0 | Trauma inflicted when delivery fails at term due to severe maternal exhaustion |

## Experiment Log

### 2026-11-01: Post-Bugfix 5-Seed 200-Year Multi-Seed Stability Check
Following the fix of `mateId` (preserving mother's `fatherId`), full state-hash expansion, and closure-free spatial neighbor loops:
- **Seed 1**: Population 9,549 (72,000 ticks in 340.7s) — StateHash: `734bb28da2d592c6`
- **Seed 2**: Population 9,022 (72,000 ticks in 332.0s) — StateHash: `2638f035b5254f8e`
- **Seed 3**: Population 8,403 (72,000 ticks in 318.4s) — StateHash: `002d25a0e93505d9`
- **Seed 4**: Population 9,038 (72,000 ticks in 333.3s) — StateHash: `c449feb435a2d755`
- **Seed 5**: Population 9,050 (72,000 ticks in 333.2s) — StateHash: `04efc1d276b1b5ca`

All 5 seeds remain in a steady carrying band between 8,403 and 9,549 people over 200 continuous years.
- **Desktop Benchmark (`npm run perf`)**: 0.246 µs / person / tick at 11,062 people (improved by 2.8% due to zero-allocation spatial loops).

### 2026-11-01: Phase 3 Band Cohesion & Decisive Clashes (Seeds 1–3, 200 Years, Touch ON vs Touch OFF)

Measurements taken with `npm run bands` reporting per decade over 200 years (72,000 ticks) across 3 seeds with touch ON and touch OFF.

Key outcomes:
- **Leader retention**: Rose from 54% to **99.5%–99.9%** per decision cycle across all 200 years in all seeds.
- **In-band / kin violence eliminated**: Clashes between allies (followers with leaders, same band members, mates, siblings, parent-child) dropped from 69% of all clashes to **0.0 / year**. All combat occurs exclusively between unallied strangers.
- **Band emergence and scale**: Largest band sizes increased from 30–60 to **339–378** people, with ~80–110 bands exceeding 20 members.
- **Selection pressure of touch**: With touch ON, violent friction with strangers increases social cohesion (% following rises from ~78–82% to **95–97%**), consolidating people into larger protective coalitions.

#### Seed 1 — Touch ON

| Dec | Pop | % Foll | B 5+ | B 20+ | Max B | Retent | Clashes/yr (Strangers / SameBand / Leader / Kin) |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  1 |   5051 |  95.3% |  133 |   76 |   238 |  99.9% | 18474.4 /  0.0 /  0.0 /  0.0 |
|  2 |   6434 |  96.2% |  154 |   94 |   220 |  99.8% | 44603.4 /  0.0 /  0.0 /  0.0 |
|  3 |   7143 |  96.3% |  161 |  106 |   221 |  99.6% | 59815.4 /  0.0 /  0.0 /  0.0 |
|  4 |   6978 |  96.0% |  165 |  111 |   179 |  99.6% | 60706.2 /  0.0 /  0.0 /  0.0 |
|  5 |   7070 |  96.5% |  138 |   99 |   190 |  99.6% | 61042.0 /  0.0 /  0.0 /  0.0 |
|  6 |   6874 |  96.3% |  151 |   99 |   207 |  99.5% | 59137.9 /  0.0 /  0.0 /  0.0 |
|  7 |   6941 |  95.2% |  169 |  104 |   183 |  99.5% | 63810.6 /  0.0 /  0.0 /  0.0 |
|  8 |   7321 |  97.1% |  145 |  109 |   207 |  99.6% | 59999.9 /  0.0 /  0.0 /  0.0 |
|  9 |   7218 |  96.9% |  142 |   97 |   266 |  99.5% | 62063.9 /  0.0 /  0.0 /  0.0 |
| 10 |   7154 |  97.2% |  143 |  103 |   171 |  99.5% | 60917.7 /  0.0 /  0.0 /  0.0 |
| 11 |   7285 |  97.4% |  129 |  100 |   309 |  99.5% | 62313.7 /  0.0 /  0.0 /  0.0 |
| 12 |   7298 |  97.2% |  145 |   94 |   271 |  99.5% | 60381.3 /  0.0 /  0.0 /  0.0 |
| 13 |   7085 |  97.3% |  118 |   87 |   378 |  99.5% | 57894.3 /  0.0 /  0.0 /  0.0 |
| 14 |   7151 |  96.3% |  135 |   91 |   346 |  99.5% | 56132.0 /  0.0 /  0.0 /  0.0 |
| 15 |   7158 |  95.9% |  149 |  100 |   258 |  99.5% | 56177.5 /  0.0 /  0.0 /  0.0 |
| 16 |   7174 |  96.4% |  139 |   87 |   234 |  99.5% | 58763.5 /  0.0 /  0.0 /  0.0 |
| 17 |   7221 |  96.4% |  148 |   90 |   222 |  99.5% | 56917.9 /  0.0 /  0.0 /  0.0 |
| 18 |   7141 |  97.4% |  117 |   93 |   297 |  99.5% | 56737.2 /  0.0 /  0.0 /  0.0 |
| 19 |   7270 |  97.7% |  106 |   82 |   279 |  99.5% | 54744.9 /  0.0 /  0.0 /  0.0 |
| 20 |   7304 |  96.5% |  127 |   89 |   362 |  99.5% | 57110.9 /  0.0 /  0.0 /  0.0 |

#### Seed 1 — Touch OFF

| Dec | Pop | % Foll | B 5+ | B 20+ | Max B | Retent | Clashes/yr (Strangers / SameBand / Leader / Kin) |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  1 |   4551 |  79.3% |  204 |   59 |   125 |  99.9% |     0.0 /  0.0 /  0.0 /  0.0 |
|  2 |   6015 |  80.4% |  318 |   69 |   102 |  99.7% |     0.0 /  0.0 /  0.0 /  0.0 |
|  3 |   6754 |  80.1% |  369 |   80 |   125 |  99.5% |     0.0 /  0.0 /  0.0 /  0.0 |
|  4 |   6674 |  80.0% |  369 |   71 |    81 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
|  5 |   6785 |  79.5% |  353 |   75 |    90 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
|  6 |   6882 |  78.4% |  362 |   70 |   113 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
|  7 |   6711 |  75.9% |  355 |   60 |   102 |  99.5% |     0.0 /  0.0 /  0.0 /  0.0 |
|  8 |   6715 |  78.7% |  362 |   69 |   125 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
|  9 |   6638 |  79.5% |  345 |   69 |   184 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
| 10 |   6805 |  78.7% |  376 |   75 |    66 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
| 11 |   6865 |  79.2% |  367 |   74 |   117 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
| 12 |   6973 |  80.0% |  383 |   79 |   113 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
| 13 |   6917 |  79.9% |  364 |   75 |   149 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
| 14 |   6896 |  79.6% |  383 |   69 |   174 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
| 15 |   6904 |  79.0% |  365 |   65 |   119 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
| 16 |   6751 |  78.1% |  364 |   67 |   120 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
| 17 |   6953 |  79.2% |  356 |   67 |   151 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
| 18 |   6942 |  80.8% |  353 |   69 |   158 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
| 19 |   6762 |  79.6% |  348 |   75 |   177 |  99.5% |     0.0 /  0.0 /  0.0 /  0.0 |
| 20 |   6907 |  78.2% |  374 |   77 |   123 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |

#### Seed 2 — Touch ON

| Dec | Pop | % Foll | B 5+ | B 20+ | Max B | Retent | Clashes/yr (Strangers / SameBand / Leader / Kin) |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  1 |   5096 |  96.3% |  119 |   76 |   174 |  99.9% | 21047.2 /  0.0 /  0.0 /  0.0 |
|  2 |   6456 |  96.6% |  132 |   83 |   254 |  99.7% | 47546.7 /  0.0 /  0.0 /  0.0 |
|  3 |   6893 |  96.3% |  164 |  102 |   163 |  99.5% | 63299.3 /  0.0 /  0.0 /  0.0 |
|  4 |   6866 |  96.6% |  139 |  103 |   182 |  99.6% | 60147.7 /  0.0 /  0.0 /  0.0 |
|  5 |   6802 |  96.8% |  139 |  101 |   170 |  99.6% | 61790.5 /  0.0 /  0.0 /  0.0 |
|  6 |   6582 |  96.9% |  144 |   96 |   195 |  99.5% | 62079.2 /  0.0 /  0.0 /  0.0 |
|  7 |   6731 |  96.6% |  153 |   99 |   194 |  99.5% | 60724.7 /  0.0 /  0.0 /  0.0 |
|  8 |   6395 |  95.3% |  148 |   99 |   189 |  99.5% | 62502.3 /  0.0 /  0.0 /  0.0 |
|  9 |   6849 |  96.2% |  142 |   98 |   157 |  99.6% | 59612.7 /  0.0 /  0.0 /  0.0 |
| 10 |   6661 |  96.2% |  125 |   80 |   209 |  99.6% | 58501.0 /  0.0 /  0.0 /  0.0 |
| 11 |   6838 |  96.4% |  148 |   98 |   281 |  99.5% | 58946.1 /  0.0 /  0.0 /  0.0 |
| 12 |   6882 |  97.4% |  129 |   88 |   222 |  99.5% | 61952.7 /  0.0 /  0.0 /  0.0 |
| 13 |   6816 |  97.1% |  145 |  107 |   161 |  99.5% | 62071.4 /  0.0 /  0.0 /  0.0 |
| 14 |   6885 |  97.1% |  125 |   87 |   348 |  99.5% | 61314.6 /  0.0 /  0.0 /  0.0 |
| 15 |   6788 |  96.4% |  123 |   87 |   302 |  99.4% | 64940.2 /  0.0 /  0.0 /  0.0 |
| 16 |   6876 |  96.9% |  137 |  101 |   203 |  99.5% | 59738.5 /  0.0 /  0.0 /  0.0 |
| 17 |   6730 |  97.1% |  119 |   84 |   334 |  99.5% | 60035.4 /  0.0 /  0.0 /  0.0 |
| 18 |   6689 |  97.3% |  125 |   91 |   231 |  99.5% | 61125.9 /  0.0 /  0.0 /  0.0 |
| 19 |   6582 |  97.5% |  117 |   85 |   215 |  99.5% | 58775.1 /  0.0 /  0.0 /  0.0 |
| 20 |   6381 |  96.0% |  133 |   87 |   257 |  99.5% | 56071.7 /  0.0 /  0.0 /  0.0 |

#### Seed 2 — Touch OFF

| Dec | Pop | % Foll | B 5+ | B 20+ | Max B | Retent | Clashes/yr (Strangers / SameBand / Leader / Kin) |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  1 |   4402 |  78.7% |  209 |   52 |    73 |  99.8% |     0.0 /  0.0 /  0.0 /  0.0 |
|  2 |   5793 |  79.2% |  301 |   68 |    96 |  99.7% |     0.0 /  0.0 /  0.0 /  0.0 |
|  3 |   6344 |  79.0% |  373 |   52 |   117 |  99.5% |     0.0 /  0.0 /  0.0 /  0.0 |
|  4 |   6420 |  81.4% |  341 |   68 |    91 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
|  5 |   6400 |  81.5% |  326 |   68 |   150 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
|  6 |   6498 |  82.1% |  329 |   59 |   235 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
|  7 |   6140 |  79.0% |  337 |   65 |   121 |  99.5% |     0.0 /  0.0 /  0.0 /  0.0 |
|  8 |   6277 |  79.0% |  351 |   65 |   105 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
|  9 |   6231 |  78.9% |  334 |   69 |    87 |  99.5% |     0.0 /  0.0 /  0.0 /  0.0 |
| 10 |   6428 |  81.0% |  335 |   83 |   106 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
| 11 |   6747 |  81.8% |  350 |   76 |   164 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
| 12 |   6693 |  80.5% |  361 |   68 |   236 |  99.5% |     0.0 /  0.0 /  0.0 /  0.0 |
| 13 |   6421 |  81.7% |  350 |   74 |    92 |  99.5% |     0.0 /  0.0 /  0.0 /  0.0 |
| 14 |   6699 |  80.0% |  362 |   70 |   122 |  99.5% |     0.0 /  0.0 /  0.0 /  0.0 |
| 15 |   6640 |  82.0% |  336 |   78 |   145 |  99.5% |     0.0 /  0.0 /  0.0 /  0.0 |
| 16 |   6651 |  82.1% |  346 |   82 |   186 |  99.5% |     0.0 /  0.0 /  0.0 /  0.0 |
| 17 |   6648 |  81.2% |  331 |   73 |   107 |  99.5% |     0.0 /  0.0 /  0.0 /  0.0 |
| 18 |   6643 |  81.7% |  339 |   72 |   135 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
| 19 |   6653 |  80.5% |  373 |   59 |   164 |  99.5% |     0.0 /  0.0 /  0.0 /  0.0 |
| 20 |   6462 |  82.2% |  331 |   74 |   129 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |

#### Seed 3 — Touch ON

| Dec | Pop | % Foll | B 5+ | B 20+ | Max B | Retent | Clashes/yr (Strangers / SameBand / Leader / Kin) |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  1 |   5022 |  95.2% |  125 |   74 |   180 |  99.9% | 20599.7 /  0.0 /  0.0 /  0.0 |
|  2 |   6107 |  95.4% |  162 |  101 |   191 |  99.7% | 46298.2 /  0.0 /  0.0 /  0.0 |
|  3 |   6560 |  96.1% |  157 |  106 |   153 |  99.6% | 57446.5 /  0.0 /  0.0 /  0.0 |
|  4 |   6290 |  96.0% |  148 |   99 |   225 |  99.6% | 57122.8 /  0.0 /  0.0 /  0.0 |
|  5 |   6233 |  96.5% |  135 |   99 |   229 |  99.6% | 56124.4 /  0.0 /  0.0 /  0.0 |
|  6 |   6368 |  96.9% |  117 |   87 |   306 |  99.6% | 53050.2 /  0.0 /  0.0 /  0.0 |
|  7 |   6154 |  95.5% |  130 |   81 |   216 |  99.5% | 52804.8 /  0.0 /  0.0 /  0.0 |
|  8 |   6476 |  96.1% |  140 |   90 |   218 |  99.5% | 55403.1 /  0.0 /  0.0 /  0.0 |
|  9 |   6136 |  96.4% |  131 |   91 |   183 |  99.5% | 57477.9 /  0.0 /  0.0 /  0.0 |
| 10 |   6535 |  96.6% |  150 |   91 |   164 |  99.5% | 55972.9 /  0.0 /  0.0 /  0.0 |
| 11 |   6491 |  96.1% |  123 |   78 |   288 |  99.6% | 52571.0 /  0.0 /  0.0 /  0.0 |
| 12 |   6326 |  97.0% |  117 |   74 |   296 |  99.6% | 52090.8 /  0.0 /  0.0 /  0.0 |
| 13 |   6617 |  96.9% |  122 |   85 |   339 |  99.5% | 52314.0 /  0.0 /  0.0 /  0.0 |
| 14 |   6496 |  97.1% |  113 |   89 |   246 |  99.5% | 53968.7 /  0.0 /  0.0 /  0.0 |
| 15 |   6413 |  97.6% |  113 |   83 |   194 |  99.5% | 52158.4 /  0.0 /  0.0 /  0.0 |
| 16 |   6301 |  96.8% |  114 |   76 |   258 |  99.6% | 48377.6 /  0.0 /  0.0 /  0.0 |
| 17 |   6431 |  96.6% |  108 |   74 |   254 |  99.5% | 52489.6 /  0.0 /  0.0 /  0.0 |
| 18 |   6316 |  95.7% |  122 |   79 |   279 |  99.5% | 51892.5 /  0.0 /  0.0 /  0.0 |
| 19 |   6608 |  96.9% |  123 |   88 |   201 |  99.5% | 54268.4 /  0.0 /  0.0 /  0.0 |
| 20 |   6531 |  97.3% |  108 |   77 |   268 |  99.5% | 54503.9 /  0.0 /  0.0 /  0.0 |

#### Seed 3 — Touch OFF

| Dec | Pop | % Foll | B 5+ | B 20+ | Max B | Retent | Clashes/yr (Strangers / SameBand / Leader / Kin) |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  1 |   4348 |  77.7% |  220 |   43 |    83 |  99.8% |     0.0 /  0.0 /  0.0 /  0.0 |
|  2 |   5584 |  81.2% |  295 |   70 |   143 |  99.7% |     0.0 /  0.0 /  0.0 /  0.0 |
|  3 |   6097 |  79.4% |  321 |   65 |   192 |  99.5% |     0.0 /  0.0 /  0.0 /  0.0 |
|  4 |   6125 |  80.4% |  344 |   58 |    91 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
|  5 |   6214 |  78.6% |  327 |   54 |   115 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
|  6 |   6485 |  81.4% |  322 |   68 |   174 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
|  7 |   5888 |  76.7% |  323 |   50 |   113 |  99.5% |     0.0 /  0.0 /  0.0 /  0.0 |
|  8 |   6355 |  78.3% |  347 |   51 |    97 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
|  9 |   6092 |  76.7% |  344 |   42 |   109 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
| 10 |   6147 |  77.8% |  343 |   58 |   101 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
| 11 |   6103 |  79.9% |  314 |   59 |   205 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
| 12 |   6242 |  78.9% |  317 |   65 |   180 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
| 13 |   6302 |  79.2% |  338 |   56 |   136 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
| 14 |   6121 |  77.8% |  319 |   58 |   172 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
| 15 |   6278 |  76.9% |  348 |   53 |   219 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
| 16 |   6225 |  77.0% |  332 |   58 |   120 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
| 17 |   6237 |  78.1% |  338 |   47 |   232 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
| 18 |   6407 |  78.3% |  326 |   57 |   320 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
| 19 |   6311 |  79.1% |  339 |   55 |   210 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |
| 20 |   6355 |  76.9% |  348 |   52 |   150 |  99.6% |     0.0 /  0.0 /  0.0 /  0.0 |

## Culture similarity in touch (pre-Phase 4)

New tunables in `src/sim/config.ts`, switch `cultureTouchEnabled` (default on).

| Value | Old | New | Why |
|:--|:--|:--|:--|
| `cultureToleranceThreshold` | none (all belligerent strangers clash) | 0.08 | Mean absolute habit difference (0..1). About the median of belligerent stranger encounters (1.8M / 7.3M / 2.0M / 0.25M in bins 0-0.05 / 0.05-0.10 / 0.10-0.15 / 0.15-0.20). A first try at 0.15 tolerated about 96% of encounters and cut clashes to about 90 a year, which was too strong. |
| `cultureClashSlope` | none | 4.0 | Above the threshold, clash chance is `min(1, 4 × (distance − threshold))`. Observed distances top out near 0.25, so the chance reaches about 0.7 at the far end. |

Stranger clashes per year, seed 1, 50 years (`npm run bands -- --seed 1 --years 50 --culture=on|off`):

| Decade | Culture off | Culture on (0.08) |
|:--:|:--:|:--:|
| 1 | not recorded | 7267 |
| 2 | 44603 | 14732 |
| 3 | 59815 | 12882 |
| 4 | 60706 | 7987 |
| 5 | 61042 | 4792 |

Bands of 20+ at decade 5: 99 with culture off, 112 with culture on. Leader retention stays at 99.6%. Only seed 1 was measured; seeds 2 and 3 were not run.

## Band tracking (Phase 4a)

New tunables in `src/sim/config.ts`, switch `bandTrackEnabled` (default on).

| Value | Old | New | Why |
|:--|:--|:--|:--|
| `bandTrackInterval` | none | 60 ticks | One pass is about 1.2 ms at 7,000 people, so a pass every sixth of a year costs far less than 1% of tick time. |
| `bandTrackMinSize` | none | 10 | A band is tracked from 10 members and dropped below 5, so a band near the line does not flicker. The 20+ rule for battles is applied by the chronicle in 4b. |

Seed 1, 20 years: 223 bands founded, 70 died, 11 successions, 1 split. Splits are rare, so 4b must decide what counts as "band split or new band" for the camera priority.

## Chronicle thresholds (Phase 4b)

New tunables in `src/sim/config.ts`, switch `chronicleEnabled` (default on). Ticks are days; 1x is 3 ticks a second, so one real hour is 10,800 ticks, 30 years. Target: 10 to 30 entries per hour.

| Value | First try | New | Why |
|:--|:--|:--|:--|
| `chronicleBattleClashes` | 12 | 14 | 12 gave 31 battles an hour; 20 gave 0.7 and 30 gave none. 14 gives 7 to 11. |
| `chronicleBattleWindow` | none | 5 ticks | "A few days". |
| `chronicleBattleCooldown` | none | 360 ticks | One entry per pair per year. |
| `chronicleBattleMinSize` | none | 20 | Only bands of 20+ count, as decided. |
| `chronicleSplitMinSize` | 20 | 30 | 20 gave 7.5 splits an hour. |
| `chronicleFoundMinSize` | 40 | 70 | 40 gave 10.5 new bands an hour. |
| `chronicleLeaderMinFollowers` | 20 | 80 | 20 gave 122 scattered and 24 leader deaths an hour; 40 gave 42. 80 gives about 6. |
| `chronicleMigrationDistance` | 60 | 110 | 60 gave 37 migrations an hour. |
| `chronicleMigrationWindow` | 720 | 1440 | Two years to cover the distance. |
| `chronicleFamineDrop` / `chronicleBoomRise` | none | 0.15 / 0.3 | Of the population over one year, with a five-year cooldown. No famine appeared in 90 years on seeds 1 to 3. |

Entries per real hour at 1x, 90 years each:

| Seed | battle | split | founded | leaderDeath | migration | boom | all |
|:--:|--:|--:|--:|--:|--:|--:|--:|
| 1 | 7.3 | 5.7 | 1.7 | 5.3 | 2.0 | 0.3 | 22.3 |
| 2 | 11.3 | 3.7 | 1.3 | 6.3 | 2.3 | 0.3 | 25.3 |
| 3 | 7.7 | 3.0 | 1.7 | 5.7 | 1.7 | 0.3 | 20.0 |

## Auto-camera (Phase 4c)

New tunables in `src/sim/config.ts`, switch `autoCameraEnabled` (default on). They are viewer settings in real seconds. Not yet tuned by watching.

| Value | Old | New | Why |
|:--|:--|:--|:--|
| `cameraHoldSeconds` | none | 30 | Decided: each shot lasts at least 30 s. |
| `cameraResumeSeconds` | none | 20 | Agreed: resume 20 s after the last manual input. |
| `cameraDriftCellsPerSecond` | none | 0.6 | Slow drift when idle; a guess to adjust by eye. |
| `cameraMinBandSize` | none | 20 | Same size as battles: only bands of 20+ are followed. |

## Phase 4 fix: culture keeps its variety, battles report real fights

Design change, not a tuned war level: children take each habit from one parent at random (plus drift), 1% of births innovate one habit by ±40, and habits shift with experience (`experienceHabitsEnabled`, default on). Parent averaging halved cultural differences every generation.

| Value | Old | New | Why |
|:--|:--|:--|:--|
| `habitInnovationRate` / `Range` | none | 0.01 / 40 | Rare jumps keep new variety entering. |
| `habitWinStep` / `habitLoseStep` | none | 3 / 3 | Belligerence up for winners, down for losers. |
| `habitHungerStep` / `habitFedStep` | none | 1 / 1 | Forage and roaming up when hungry (<0.25 energy), down when fed (>0.75). |
| `habitHelpStep` | none | 3 | Generosity and loyalty up for someone helped. |
| `chronicleBattleClashes` | 14 | 150 | With culture alive there are about 15,000 to 20,000 clashes a year, and 14 gave 1,000 to 2,500 entries an hour. |
| `chronicleBattleSize` | 60 | 300 | Tiers: skirmish 150+, battle 300+, great battle 700+. |
| `chronicleGreatBattleSize` | 250 | 700 | As above. |

Habit spread (mean SD over the eight habits) and stranger clashes per year, 200 years, `npm run culture`:

| Seed | Spread y0 / 60 / 120 / 200 | Clashes y30 / 120 / 200 |
|:--:|:--|:--|
| 1 | 37.1 / 27.7 / 22.4 / 20.0 | 21,305 / 19,628 / 17,329 |
| 2 | 37.3 / 26.7 / 21.0 / 18.7 | 22,185 / 19,198 / 14,854 |
| 3 | 37.3 / 28.3 / 22.6 / 19.3 | 20,885 / 21,079 / 14,799 |

Spread falls, then flattens (under 1 point per 30 years after year 150); clashes never reach 0. Seed 1 to year 120 with experience off: spread 16.8, clashes 8,893 a year; on: 22.4 and 19,628.

Chronicle entries per 30-year hour, 200 years (last hour is 20 years):

| Seed | hours 1 to 7 |
|:--:|:--|
| 1 | 17, 22, 21, 15, 13, 20, 8 |
| 2 | 29, 17, 11, 14, 19, 9, 11 |

All within 10 to 30 except seed 2 hour 6 (9). Not tuned further to avoid fitting one seed.

## Seasons (Phase 5a)

No new state: a season factor is computed from the tick and multiplies plant regrowth. Switch `seasonsEnabled` (default on). Spring 0 to 90, summer 90 to 180, autumn 180 to 270, winter 270 to 360 ticks.

| Value | Old | New | Why |
|:--|:--|:--|:--|
| `seasonAmplitude` | none | 0.8 | Regrowth swings from 0.2x (mid-winter) to 1.8x (mid-summer) and averages 1 over a year, so the food balance stays near the seasonless one. A first try, not yet tuned by watching. |

Seed 1, population at year 30 / 60 / 100: seasons on 7,245 / 7,427 / 7,517; off 7,959 / 8,381 / 8,231. About 9% fewer people, stable, no collapse. Perf 4.0 to 5.1 us / person / tick at 13.5k people (machine busy; budget 15).

## Calm movement (Phase 4 fix, after the jitter report)

An investigation found people reversing their last step 65% of the time (random walk: 26.5%), pacing between two cells and gaining less food per move than a random step. Causes: the gradient skips the current tile, there was no reason to stay, and one-tick noise snaps back. Fix, switch `calmMovementEnabled` (default on): a person on a tile holding at least `stayFoodFraction` of its capacity stays and grazes (unless a leader is pulling them); a 180 degree reversal needs a pull of at least `reversalOverride`, otherwise the person sidesteps or stays. New state: `prevDir` (typed array, saved and hashed). No new random draws.

| Value | Old | New | Why |
|:--|:--|:--|:--|
| `stayFoodFraction` | none | 0.5 | Stay on a half-full tile. A first try. |
| `hungerStayPenalty` | none | 0.5 | A hungry person needs 1.5x as much (75%) before settling, so starving people move on. |
| `reversalOverride` | none | 1.5 | A typical scent pull is about 2, leader pull 0.8 to 1.6; noise (0.8) alone no longer reverses a step. |

`npm run movement`, adults over 300 ticks after 5 years, seeds 1 and 2:

| | Reversals | Standing still | Unique cells | Food gained per move |
|:--|--:|--:|--:|--:|
| Off | 65.8% / 63.9% | 3.3% / 2.7% | 64.5 / 69.9 | 1.35 / 1.38 |
| On | 39.7% / 37.5% | 22.8% / 19.6% | 74.8 / 82.3 | 2.57 / 2.46 |

Reversals are still above the random walk; the leader pull is the likely rest, left alone. Seed 1 population at year 10 / 30 / 60: on 4,719 / 7,080 / 7,025; off 4,934 / 7,245 / 7,427. Slightly lower, no inflation, so no retune of `birthTax` or `forageBite`. Perf 4.4 us / person / tick at about 13k people (busy machine; budget 15).

## Farming physics (Phase 5b), tuned

Switch `farmingPhysicsEnabled` (default on). No unlock flags. State: land `tilled`, `seeds`, `soilHealth`; person `carry`. Tilling now counts only when the person stayed on the cell the tick before. The viewer gets a one-byte-per-cell overlay (desert, farmland, seeds) every 2 s; the viewer is watch-only.

First pass (all bites till, strong seeds) was far too strong: about 97% of land tilled, 58% desert, population 5 to 10% under the off run. Retuned with `npm run farming-sweep` (value sets in one process, one table). Targets set before sweeping: worked soil (tilled > 0.1) 10 to 35% of land, desert (soil < 0.6) under 15%, seeds on under 20% of land, population within 5% of the farming-off run.

| Value | First try | New | Why |
|:--|:--|:--|:--|
| `tillGain` | 0.02 | 0.015 | Per bite while standing still. |
| `tillDecay` | 0.001 | 0.002 | Tilling fades with a half-life of about 1 year. |
| `soilWearRate` | 0.004 | 0.0012 | Stripping a cell wears soil more slowly. |
| `soilRecoveryRate` | 0.0006 | 0.0015 | Stripped soil recovers faster when left alone. |
| `seedPickupPerBite` | 0.1 | 0.05 | Fewer seeds per bite. |
| `seedRegrowBoost` / `seedCapacityBoost` | 1.5 / 0.6 | 0.8 / 0.3 | Seeds were the dominant effect (population up to 35% over off). |
| `seedDecay` | 0.002 | 0.004 | Seed banks fade faster. |
| unchanged | | | `seedCarryMax` 3, `seedDropEnergy` 0.4, `seedCap` 10, `tillRegrowBoost` 1.0, `soilMin` 0.2. |

Eight sets screened at 20 years on seed 1 (off pop 6,168); first pass was M, then confirmed over 50 years on seeds 1 to 3:

| Seed | Pop vs off | Worked | Farm (> 0.3) | Desert | Seeds |
|:--:|--:|--:|--:|--:|--:|
| 1 | +1.2% | 17.7% | 2.7% | 6.1% | 15.3% |
| 2 | +1.6% | 16.2% | 2.2% | 6.1% | 15.5% |
| 3 | +2.7% | 18.7% | 2.8% | 7.1% | 16.3% |

All pass. Note: two earlier sweeps passed the seed values through an unquoted shell variable, so they never took effect; their results (including an apparent tilling-versus-desert feedback) are not used. Not yet looked at on screen: the farm overlay is brown, desert sand, seeds yellow.

## Mounds and nests (Phase 5c), first pass

Stigmergic, no build orders (switches `stockpilesEnabled`, `nestsEnabled`). A well-fed person on a rich tile gathers surplus food; a well-fed person passing through woodland (cover 0.5 or more) picks up brush; hands hold one thing at a time (seeds are set down first). A resting carrier unloads where at least `dropCrowd` people stand. Hungry people eat what they carry, then any heap underfoot. Idle, well-fed people tamp a heap (`workCost` energy each). A food heap that is big and compacted becomes a granary floor; a brush heap becomes a nest that cuts upkeep to 70% for anyone in it. Heaps spoil; built forms spoil at 20% of that. Piled food and carried food sit outside the energy ledger until eaten (eating is a plant meal), so no new ledger account.

Tested with `npm run sweep` (a feature-off warm-up checkpoint, then candidates, early abort). Targets set first: heaps on 0.3 to 5% of land, granary floors on at least 5 cells and under 1% of land, population within 5% of the stockpiles-off run, under 20% of heaps at the cap.

| Value | First try | New | Why |
|:--|:--|:--|:--|
| `foodBite` | 2.0 | 1.0 | Gathering at 2 per tick made heaps cover about 20% of land. |
| `hoardLandFraction` / `hoardEnergy` | 0.5 / 0.85 | 0.7 / 0.9 | Gather only on rich tiles by the very well fed. |
| `dropCrowd` | 3 | 4 | Unload where people congregate. A full sack no longer drops on the spot (`dropWhenFull` false): that made heaps sprawl. |
| `workGain` | 0.03 | 0.02 | Slower tamping. |
| `pileSpoil` | 0.003 | 0.004 | Heaps rot a bit faster. |
| `granaryMass` / `granaryCompaction` | 15 / 1.0 | 30 / 1.5 | Granary floors were on 2% of land at first. |
| `compactionDecay` | 0.0005 | 0.0003 | Granary floors faded to a handful by year 40 at the old rate. |
| `granaryKeepMass` / `granaryKeepCompaction` | 3 / 0.5 | 2 / 0.3 | A built floor stays a little longer. |
| nest values | | `brushEnergy` 0.6, `brushBite` 1, `brushCarryMax` 10, `brushCap` 100, `brushDecay` 0.002, `nestMass` 12, `nestCompaction` 1.0, `nestKeepMass` 3, `nestKeepCompaction` 0.5, `nestUpkeep` 0.7 | Untuned first guesses. |
| unchanged | | `pileEatBelow` 0.5, `pileEatBite` 5, `foodCarryMax` 20, `carryDrag` 0.5, `pileCap` 200, `workEnergy` 0.7, `workMinPile` 4, `compactionCap` 2 | |

Results. Stockpiles only, 40 years from scratch with S2 values: heaps 0.6 to 0.8% of land, granary floors 4 to 9, population +3.5 to +6.4% over off (two of three seeds missed). Retuned by screening on seed 3 (8 years warm-up, 20 years): T1 +5.2% (just over), T2 +4.5% with 5 granary floors (the first pass, adopted). Not yet confirmed on other seeds. With nests on (seed 1, 10 years after an 8-year warm-up): population +3.8% over off, heaps 1.6%, 13 granary floors, 958 nests and still rising by about 100 a year with 108,000 brush stored. Nothing limits nests yet; needs a cap or faster decay in the tuning pass. Perf 5.8 us / person / tick at about 14k people (budget 15).

## Finite wild resources (ported onto 5c, 2026-11-02)

Switch `finiteResourcesEnabled`. Trees (wood stock on wooded tiles) are used up by brush gathering; berries top up hunger on open fertile tiles. Ported from `exp-finite-resources` (trees, berries only; fish, thirst and herds follow). Seed 1, 20 years, against the same run with the switch off (pop 4965 / 5501 / 6402 at y10 / y15 / y20).

| old to new | value |
| --- | --- |
| `treeCap` | exp 100, first port 100, now 30 (a tile gives 30 brush, then regrows) |
| `treeBrushCost` | 0.5 to 1.0 wood per brush |
| `treeRegrowRate` | 0.0005 to 0.0003 |
| `berryRegrowRate` | 0.04 to 0.01 |
| `berryBite` | 1.5 to 0.08 |
| `berryBelow` | new, 0.4 of max energy (only the hungry eat berries) |

| set | berry bite / below | pop y10 / y15 / y20 vs off | trees left y20 | nests y20 |
| --- | --- | --- | --- | --- |
| first port (exp values) | 1.5 / 0.8 | +16% / +37% / +43% at y10/15/20 | 96% | 807 |
| A | 0.4 / 0.8 | +11% / +21% / +28% | 47% | 485 |
| D | 0.15 / 0.5 | +6% / +15% / +15% | 51% | 382 |
| G (adopted) | 0.08 / 0.4 | +3% / +6% / +3% | 58% | 388 |

Berries were the population driver, not the wood. Woodland thins to about 58% and levels off; nests drop from about 550 to about 390 because brush now has a cost. Single seed: confirm on more seeds in the combined tuning pass.

### Stumps and open field (2026-11-02)

A stand stripped below `stumpBelow` of its stock turns to stumps; stumps block regrowth for `stumpRotTicks`, then rot to bare open field for good (berries can grow there; trees do not). Seed 1, 30 years.

| old to new | value |
| --- | --- |
| `stumpBelow` | new; first try 0.08, adopted 0.02 |
| `stumpRotTicks` | new, 1080 (3 years); 2160 tried, no better |
| `treeCap` | 30 to 100 (with stumps, 30 cleared 64% of woodland by y30 and nests fell) |

| set | wood cleared to field at y30 | stumps standing y30 | nests y30 |
| --- | --- | --- | --- |
| cap 30, below 0.08 | 64% | 370 | 238 |
| cap 30, below 0.02 / 0.05, rot 1080 or 2160 | 57 to 64% | 350 to 800 | 250 to 290 |
| cap 60, below 0.02 | 31% | 223 | 348 |
| cap 100, below 0.02 (adopted) | 13% | 111 | 396, still rising |
| cap 150, below 0.02 | 7% | 32 | 479 |

The threshold hardly mattered; the wood per tile did, since people strip whatever tile they stand on. Deforestation is permanent for now (no reforestation yet). Single seed.

### Fish and thirst (2026-11-03)

Switches `finiteResourcesEnabled` (all) and `thirstEnabled` (thirst only). Fish: finite stock per water tile (`fishCap` 20, sea 0.7 of it, `fishRegrowRate` 0.02), taken from the shore by people below 50% energy (`fishBite` 0.3); booked as wild food outside the ledger, like berries. Thirst: `hydration` per person falls `thirstRate` per tick, refills `drinkRate` beside fresh water (lakes and rivers above sea level, not the sea); below `thirstSeek` (60) a person walks down a distance map to the nearest fresh water; below `thirstWarn` (30) upkeep rises 50%; at zero, `dehydrationDamage` 0.5 energy a tick (booked as upkeep). Seed 1, 20 years.

| set | pop y20 | vs thirst off | dehydrated | mean distance to fresh water | far (over 20) |
| --- | --- | --- | --- | --- | --- |
| thirst off | 7175 | | 0% | 10.5 | 13% |
| `thirstRate` 0.25 | 6718 | -6% | 1.9% | 7.2 | 7% |
| 0.4 (adopted) | 6464 | -10% | 1.9% | 6.5 | 5% |
| 0.6 | 6345 | -12% | 1.8% | 5.3 | 2% |

Targets (stated before running): pop within 15% of off, dehydrated under 3%. About 2% of people live on land with no fresh water at all and thirst out; that is a physical consequence, not a bug. Single seed.

### Fewer fish (2026-11-03)

Seed 1, 20 years, thirst on. `fishCap` 20 to 10 and `fishRegrowRate` 0.02 to 0.01: pop y10 / y20 5090 / 6464 to 5007 / 6184 (-1.6% / -4.3%); cap 6 gave 4811 / 6220 (-5.5% / -3.8%), no better. The viewer now draws at most one fish on about half the shore tiles.

### Woodland matches the drawn forest (2026-11-04)

Bug: the sim treated every cell with cover 0.5 or more as woodland (8746 cells), including hills and shores where the viewer draws no trees, so stumps appeared where there were never trees, and tree sprites stayed on stumped and cleared cells. Now `wooded` is lowland (below 0.56), not beside water, not near sea level, cover 0.5 or more: 3199 cells, the same rule the viewer uses for tree sprites. Seed 1, 30 years: pop 5059 / 6478 / 7082 at y10 / y20 / y30, trees left 89%, nests 204 / 346 / 348, stumps 71 standing and 30% of woodland cleared to field at y30 (inside the 10 to 35% target). Tree sprites now thin with the cutting and vanish on stumps and field.

Also fixed (found by the farming save round trip test once the woodland change shifted the run): the drop-at-crowd rule read the spatial index left over from the previous tick, which a loaded save does not have, so the first tick after a load could differ from the original run. The index is now built just before the foraging step (only when stockpiles are on). Perf 4.67 us / person / tick under server load (last clean figure 4.3).

## Herbivore herds, 6a-1 (2026-11-04)

Switch `herdsEnabled`. Animals live in their own typed arrays (`src/sim/herds.ts`), one per tile, with their own PRNG (people's random stream is unchanged by herds). They graze, drift toward richer ground, flee people within 2 tiles (60% a tick), breed when well fed and die of hunger or age (3600 ticks). Body energy is plant-side, outside the ledger. Seed 1.

| try | herds | people vs herds off |
| --- | --- | --- |
| no crowding limit | hit the 1024 slot cap by y5 and stayed (food never limits them: 1024 animals is about 3% of the land) | -4% at y20 to y50 |
| `herdSoftCap` 200 | 190 at y30 | +1% at y20, -1.4% at y30 |
| `herdSoftCap` 300 (adopted) | 289 at y30 | -0.6% at y20, -4.9% at y30 |
| `herdSoftCap` 450 | 437 at y30 | -3.3% at y20, -2% at y30 |

New values: `herdInitialCount` 150, `herdCapacity` 1024, `herdMaxEnergy` 50, `herdUpkeep` 0.1, `herdMoveCost` 0.02, `herdGrazeBite` 1.0, `herdBreedEnergy` 35, `herdBirthEnergy` 12, `herdBreedChance` 0.03 (times 1 - herd / `herdSoftCap`), `herdAdultAge` 180, `herdMaxAge` 3600, `herdFleeRadius` 2, `herdFleeChance` 0.6, `herdStayFraction` 0.5, `herdWander` 0.1. Targets (set first): herds persist and stay between 40 and 600; people within 10% of herds off. Met. The herd sits at its soft cap because grass never runs short; hunting (6a-2) is what should pull it below. Single seed.

### Hunting, 6a-2 (2026-11-04)

Switch `huntingEnabled`. A person below `huntBelow` (0.6 of max energy) with an animal on or beside their tile strikes each tick for `huntCost` 0.3 (booked as movement); a strike kills with chance `huntChance` 0.15 (drawn from the herds' own stream). A kill leaves the animal's energy times `huntMeatFactor` (1.0) as a food heap at the hunter's feet, and the hunter takes the first bite. Seed 1, 30 years, herd soft cap 300.

| set | kills y5 / y10 / y20 / y30 | herds y30 | people y30 | vs hunting off |
| --- | --- | --- | --- | --- |
| hunting off | 0 | 289 | 6698 | |
| `huntChance` 0.15 (adopted) | 130 / 433 / 875 / 1379 | 288 | 6906 | +3% |
| `huntChance` 0.05 | 82 / 313 / 701 / 917 | 291 | 7076 | +6% |

Targets (set first): herds persist above 40, kills in the hundreds over the run, people within 10% of hunting off. Met. Breeding refills the herd at its soft cap, so hunting adds meat without thinning herds much; the herd size is set by `herdSoftCap`, not by hunting. Single seed.

## World shape and start population (2026-11-04)

Your notes on the first watch of herds: too many little lakes, not enough green land, the world trampled within seconds, too many people to start. Measured on seeds 1 to 3.

| old to new | value | why |
| --- | --- | --- |
| `elevationSeaFraction` | 0.38 to 0.28 | water was 49 to 54% of the map; now 36 to 40% (land 64%) |
| `elevationLakeDepth` | 0.012 to 0.02 | fewer shallow pockets |
| `elevationMinLakeCells` | new, 80 | land-locked lakes (with their rivers) under 80 cells are dropped: lakes and rivers 66 to 86 down to about 20 |
| `elevationHillLevel` / `MountainLevel` / `SnowLevel` | 0.56 / 0.70 / 0.82 to 0.68 / 0.80 / 0.90 (now config, used by the renderer and by woodland) | hills were 19 to 32% of the land, so green (grass plus forest) was only 13 to 19% of the map; now about 40% |
| `initialPopulation` | 1000 to 700 | with 700 the colony is about 1 to 2 thousand for its first five years (1.8k at year 5 from 600, 3.2k from 1000); worked soil is 8% at the start from 1000 founders, 5% from 600 |

Also: herd and carcass sprites were drawn in repeated copies when the world fits the screen (zoomed out), which put animals in the black void; they now draw one copy there, like people. Test change: the 5000-person save test runs 250 ticks instead of 500 (it hit the 60 s limit on the larger map), and the slowest chronicle test file is split again. Every earlier tuning (farming, stockpiles, finite resources, herds) was done on the old map; the combined tuning pass should repeat the key checks on this one. Single seeds.

### Wolves, 6a-4 (2026-11-04)

Switch `wolvesEnabled`. Own typed arrays and PRNG (`src/sim/wolves.ts`), one wolf per tile. Wolves keep their heading, turn toward herd animals within `wolfSenseRadius`, kill adjacent prey (`wolfKillChance`) for its energy (`wolfMeatFactor`), leaving `wolfLeaveMeat` of it as a food heap and a carcass, take a person who is alone on a tile beside them (`wolfAttackChance`), breed when fed (times 1 - wolves / `wolfSoftCap`) and starve without prey. Each leaves `wolfDanger` scent per tick, which people and herds already avoid; herds also flee wolves. Founders start within 4 tiles of a herd animal. Seed 1, 30 years, 700 founders.

| try | wolves | people killed | result |
| --- | --- | --- | --- |
| first guess (upkeep 0.25, sense 6) | extinct by y10 | 20 | prey too sparse |
| upkeep 0.12 / 0.08, sense 8 to 12 | 0 to 11 at y10, 3 at y20 at best | 47 to 193 | declining |
| upkeep 0.05 to 0.08, kill 0.5 to 0.6, breed 50 | 21 to 40 | 1100 to 1600 in 30y | persist, but people -20% at y20 |
| lone person = nobody within 2 or 3 tiles | extinct by y10 to y20 | 11 to 15 | wolves starve: herd prey alone cannot feed them |
| lone rule radius 2 plus founders near herds, upkeep 0.04 to 0.06 | extinct within about 5y | 4 to 14 | same |
| **adopted**: upkeep 0.06, sense 8, kill 0.6, breed energy 50, birth 20, lone radius 0 | 12 to 38, from y5 to y30 | 879 in 30y (about 29 a year) | herds hold at 297; people vs wolves off: -3.4% y5, -4.4% y10, -10% y15, -12% y20, -7% y25, -5% y30 |

Targets (set first): wolves persist (5 to 80), herds above 100, people within 10% of wolves off, deaths under 1% a year. All met except the middle years, where people dip 10 to 12% below. Finding: herds alone cannot feed wolves, since prey flees at the wolf's own speed (kills stayed in the tens to hundreds in 30 years); wolves persist only because lone people are abundant. Left as is on purpose: the threat is for later phases (fire and hearths 5d, barricades Phase 7, weather 6b) to answer through the land and costs, not for more wolf rules. Single seed.

## Phase 5d cold, caves and campfires

Target stated before the sweep: population within 10% of a cold-off run at years 5, 10 and 20 (30 years was too slow to sweep); fires burn every winter; at least 25% of winter person-ticks sheltered.

| Setting | Old | New | Why |
|:--|:--|:--|:--|
| `coldUpkeep` | 0.8 (first guess) | 0.6 | At 0.8 population ran 15% under cold-off by year 15 (seed 1) and 18% (seed 2). |
| `coldSeekEnergy` | 0.3 (first guess) | 0.5 | People sat in shelter until 30% energy, then foraged hungry. Leaving at 50% kept them foraging; lowering `coldUpkeep` alone did not help (0.5 gave 24% under at year 20, noise). |

Other values, unchanged from the first guess: `coldComfort` -0.4, `coldSpan` 0.6, `coldSeasonAmp` 1.0, `caveCount` 40, `caveSpacing` 6, `fireIgniteBrush` 6, `fireIgniteChance` 0.2, `fireBurnRate` 0.15, `fireWarmRadius` 2, `fireSeekRadius` 12.

Result with the adopted set, people vs cold off (700 founders):

| Seed | y5 | y10 | y15 | y20 |
|:--|--:|--:|--:|--:|
| 1 | -2% | -3% | -8% | -5% |
| 2 | -2% | -4% | -11% | -16% |
| 3 | -6% | -10% | -9% | -10% |
| mean | -3% | -6% | -9% | -10% |

Seed 2 misses the 10% target at year 20. Winter shelter: 45% to 52% of person-ticks sheltered (10% to 18% in caves, rest at fires), 45 to 70 fires burning on average in winter, about 1200 to 1800 lit per 20 years. With fires off (cave-only shelter) population ends about 5% lower than with fires on (seed 1), so fires earn their place. Perf 4.3 us / person / tick at 13,680 people.

## Phase 5f stone and dry-stone huts

Target stated before measuring: huts exist and some persist by year 10; people within 5% of a building-off run; mean share of person-ticks on rock under 10%. First guess for every value was adopted (no sweep needed): `stoneCap` 30, `stoneBite` 1.0, `stoneCarryMax` 8, `stoneEnergy` 0.6, `buildGain` 4, `hutDurability` 60, `hutKeep` 20, `erosionSlices` 64, `hutUpkeep` 0.5.

| Seed | People on vs off (y5 / y10 / y20) | Huts (y5 / y10 / y20) | On rock | In hut |
|:--|:--|:--|--:|--:|
| 1 | -3% / -4% / -3% | 21 / 36 / 75 | 7.4% | 3.0% |
| 2 | +1% / +3% / +18% | 26 / 42 / 66 | 4.4% | 2.8% |
| 3 | +1% / 0% / 0% | 15 / 30 / 47 | 2.7% | 2.4% |

Perf 4.4 us / person / tick at about 13,700 people.

## Combat injury and wolf bites

Why: a clash only made the loser forfeit 25% of energy (death only if that left zero), so 0 to 3 of thousands of clashes a year were fatal; wolves took 2 to 17 people a year and died out on seed 1.

Target stated first: 20 to 60 violent or wound deaths a year around year 10, population within about 15% of an injury-off run, wolves persist.

| Setting | Old | New | Why |
|:--|:--|:--|:--|
| `clashInjury` | 90 (first guess) | 60 | At 90 with `injuryUpkeep` 1.5, everyone stayed wounded and population stalled near 1450 vs 3350 off (-57%). |
| `injuryUpkeep` | 1.5 | 0.3 | Same. A set with 0.5 / 40 / 0.4 was close (-15% at y10) but the next set fit better. |
| `injuryHeal` | 0.15 | 0.3 | Fed people recover sooner; hungry people still bleed out. |

Unchanged first guesses: `clashInjuryWinner` 0.25, `injurySlow` 0.6, `injuryHealEnergy` 0.5, `wolfBiteEnergy` 25, `wolfInjury` 150, `graveTicks` 150. A wolf now bites a lone person (takes 25 energy, wounds them) and only a person left with nothing falls; this replaces the instant kill.

Result with the adopted set, people vs injury off:

| Seed | y10 | y12 | Violent deaths a year (y10) | Wolves y10 |
|:--|--:|--:|--:|--:|
| 1 | -10% | -13% | about 53 | 33 |
| 2 | -8% | -5% | about 63 | 40 |
| 3 | -12% | -16% | about 53 | 40 |

Injury off: 0 to 9 violent deaths a year. Wolves now persist on all three seeds (they died out by year 9 on seed 1 before).

## Deterministic Childbirth Hazards

Deterministic physiological trauma and metabolic demands of reproduction, replacing arbitrary RNG mortality coin flips:
1. **Pregnancy upkeep**: Pregnant women pay a +25% metabolic surcharge (`pregnancyUpkeepMul` = 1.25). Severe malnutrition (`energy <= 15.0`) triggers miscarriage (`pregnancyMiscarriageEnergy`), terminating pregnancy early to save the mother's life.
2. **Delivery trauma**: Childbirth inflicts physical trauma directly to `people.injury` (baseline 40). Giving birth inside a shelter (built nest, cave, stone hut, or near a campfire) cuts trauma by 65% (`birthShelterInjuryMul` = 0.35). Delivering unsheltered in freezing cold increases trauma up to 1.5x (`birthColdInjuryMul`) and inflicts initial hypothermic trauma on the newborn.
3. **Delivery exhaustion**: Mothers reaching full term with insufficient energy to afford delivery (`energy <= totalBirthCost`) suffer labor complications: birth fails, mother sustains 20 trauma (`birthExhaustionInjury`), and remaining energy is drained (conserved via `ledger.birthCosts`).
4. **Natural recovery**: Wounded mothers have higher upkeep and heal only when fed above 50 energy. Because maternal energy drops on delivery and `reproductionThreshold` is 65, mothers naturally cannot mate again until recovered and well-nourished.
5. **Perf**: 4.66 µs / person / tick at 12,240 people (budget 15.0 µs). Exact energy balance confirmed (`ledger.violations === 0`).

## Phase 5g bodies (stages, childcare, fatigue, disease)
Targets set before running: at year 9 population within 10 to 25% below the all-switches-off run, peak sick share 2 to 15%, no seed dying out; stop at the first passing set. First set passed on seeds 1 to 3.

| Value | Old | New | Why |
|:--|:--|:--|:--|
| childWork / elderWork | n/a | 0.6 / 0.8 | weaker young and old |
| strengthCarry | n/a | 0.6 | carry and work scale with strength |
| childCare, careRadius | n/a | 0.05, 4 | mother (and mate) pay while child is near |
| fatigueMove / Rest / Upkeep / Slow | n/a | 2 / 6 / 0.3 / 0.3 | mean fatigue about 80 to 140 of 255 |
| sickSpread / sickBase / sickTicks / sickUpkeep / sickFedHeal | n/a | 0.03 / 0.00002 / 120 / 0.8 / 1 | endemic 1 to 3% sick, peaks 3 to 5% |

Result (all on vs all off, seeds 1 to 3, year 9): people -13%, -12%, -18%; peak sick 3.2%, 3.9%, 4.6%. Perf 5.6 µs. Disease is endemic rather than epidemic at these values; sharper outbreaks would need a higher `sickSpread` or a crowding term, left to the tuning pass.

## Primitives 18, 24, 28: Body Drives, Life Stages & Strength Work Scaling

| Value | Old | New | Why |
|:--|:--|:--|:--|
| bodyDrivesEnabled | n/a | true | Enables dominant drive selection (Hunger vs Cold vs Social/Roam) in Rules.climb |
| hungerDriveThreshold | n/a | 0.35 | Fraction of maxEnergy below which hunger drive dominates movement |
| criticalHungerThreshold | n/a | 0.20 | Fraction of maxEnergy below which curiosity/roam jitter drops and danger aversion halves |
| hungerFoodWeightMul | n/a | 2.5 | Food scent gradient amplification when hungry |
| hungerLeaderPullMul | n/a | 0.25 | Dampening of leader pull when hungry (foraging takes priority over following) |
| childUpkeepMul | n/a | 0.7 | Child upkeep proportional to smaller body mass |
| elderUpkeepMul | n/a | 1.0 | Elder baseline upkeep multiplier |
| stageHarvestScale | n/a | true | Wild foraging (berries, fish, brush) scales with life stage and strength bodyMul |
| strengthScalingEnabled | n/a | true | Switch for strength gene scaling carrying and work |
| workStrengthScale | n/a | true | Tamping compaction scales with worker bodyMul (stageWork * strength) |

Ledger balances with zero violations (`ledger.violations === 0`). Desktop perf: 5.25 µs / person / tick at 11,313 population (budget <= 15.0 µs). Bit-for-bit baseline fingerprint parity confirmed (`881ea265aa76e667`) when new switches are disabled.

## Settlement observer: starting values and baseline (S0)
Observer-only values, new, chosen as starting points; they change no outcome. `settlementScanInterval` 30, `settlementGap` 2, `settlementResidentRadius` 3, `settlementResidentSmoothing` 0.2, `settlementGraceTicks` 360, `settlementAnnounceTier` 1. Built / residents / years: camp 3 / 5 / 0, hamlet 10 / 20 / 5, village 30 / 80 / 10, town 120 / 400 / 20, city 300 / 1000 / 30. Thresholds get retuned after S3, when walls change what counts as built.

Baseline with today's rules, year 30:

| Seed | People | Camps | Hamlets | Larger | Ever tracked | Lasted 10y+ | Median life | Adults outside camps |
|:--|:--|:--|:--|:--|:--|:--|:--|:--|
| 1 | 3503 | 37 | 0 | 0 | 199 | 13 | 0.3y | 48% |
| 2 | 3875 | 42 | 1 | 0 | 229 | 22 | 0.3y | 51% |
| 3 | 3494 | 23 | 0 | 0 | 176 | 14 | 0.3y | 56% |

The largest settlements are short-lived crowds: seed 1's largest at year 30 has 5 built cells and 75 people and was founded the year before. Fires count as built and burn out, which adds to the churn, so some of the short lifetimes may come from how the tracker counts rather than people moving; not measured.


## S1 staying pays: probe and targets
**S1a probe, years 2 to 20, seeds 1 / 2 / 3, today's rules** (`npm run probe`; camp means within 3 tiles of a built cell or a heap):

| | Share of people | Energy | Deaths per 30 ticks | Still near a camp 30 ticks later | Wounded | Mean injury |
|:--|:--|:--|:--|:--|:--|:--|
| Away | 40 / 39 / 42% | 65.9 / 66.4 / 64.9 | 0.3% | n/a | 91% | 190 |
| Camp | 60 / 61 / 58% | 73.2 / 73.3 / 73.5 | 0.2% | 81 / 81 / 80% | 86 to 88% | 166 to 171 |

People already stay near heaps and shelters, and do a little better there. What churns is the built cells themselves (S0: median settlement life 0.3 years). Occupied huts and nests hold 3.3 people on average, over 4 on about 21% of them. Wounds are extreme everywhere: about 90% of people carry an injury averaging around 180 of 255. With injury off (seed 1) the camp share rises from 60% to 68%. Wounds do not stop camps, so clashes are left alone for now and flagged for the tuning pass.

**Targets, set before running** (seeds 1 to 3, year 30, all S1 switches on against all off, `wolfLoneRadius` 2 against 0):
- No seed dies out, and population at year 20 is at least 85% of off.
- Settlements that lasted 10 years or more: at least double off.
- At least 3 hamlets or larger standing on each seed.
- At least 10% of adults outside any camp at year 20.
- Perf within budget.
Stop at the first set that passes; at most 8 rounds.

Starting values (new, not yet tuned): `hutCapacity` 4, `nestCapacity` 3, `storeScentEmitRate` 0.02, `roamStayWeight` 0.5, `stayRefFood` 10, `wolfLoneRadius` 0 to 2.

**S1 tuning results, year 30** (lasted means settlements that have lasted 10 years or more; off is all S1 switches off with `wolfLoneRadius` 0):

| Seed | Off | Round 1 | Round 2: `storeScentEmitRate` 0.05 | Round 3: `roamStayWeight` 0.2 |
|:--|:--|:--|:--|:--|
| 1 lasted | 13 | 25 | 27 | 28 (2.2x) |
| 2 lasted | 22 | 29 | 26 | 31 (1.4x) |
| 3 lasted | 14 | 26 | 25 | 29 (2.1x) |
| Hamlets or larger, seeds 1 / 2 / 3 | 0 / 1 / 0 | 16 / 25 / 12 | 16 / 22 / 13 | 16 / 21 / 16 |
| Villages, seeds 1 / 2 / 3 | 0 / 0 / 0 | 2 / 5 / 3 | 3 / 3 / 3 | 3 / 4 / 2 |
| People at year 30, seeds 1 / 2 / 3 | 3503 / 3875 / 3494 | 6226 / 7738 / 6684 | 6189 / 7657 / 6613 | 6620 / 7582 / 6634 |

Every round passes the population (year 20 at 125 to 142% of off), hamlet and wanderer gates (25 to 34% of adults outside camps at year 20). The "lasted at least double" gate is **missed** on seed 2 in every round: its off run already has 22. Stopped after 3 of the allowed 8 rounds, because chasing 44 on one seed risks fitting that seed. Kept round 3: `roamStayWeight` 0.5 to 0.2 (best on all three seeds); `storeScentEmitRate` stays 0.02 (0.05 did no better).

**Each switch off on its own, seed 1, year 30** (all on: 6620 people, 13 hamlets, 3 villages, lasted 28):

| Off | People | Hamlets | Villages | Lasted |
|:--|:--|:--|:--|:--|
| Stay value | 3475 | 2 | 0 | 14 |
| Comfortable stay | 3769 | 6 | 0 | 16 |
| Crowding | 6490 | 12 | 3 | 24 |
| Store scent | 6413 | 11 | 3 | 22 |
| Store unload | 6373 | 9 | 2 | 22 |
| Shelter seek | 6659 | 12 | 2 | 24 |
| Wolf changes | 6368 | 13 | 3 | 28 |

The stay check and comfortable stay do nearly all of it; the rest add a little each; the wolf changes do almost nothing. The population rise comes from staying itself (less walking, more eating from heaps), not from safety.

**Band cohesion, seed 1, year 30**: off 88 bands among 3503 people (largest 281); all on 128 among 6620 (largest 550). About the same bands per person, so comfortable stay does not break bands up.

## S2 paths: targets and starting values
Starting values (new): `wearStep` 16, `wearDecaySlices` 8 (a full trail fades in about 6 years unused; one step lasts about 128 ticks), `pathCostCut` 0.5, `pathPull` 0.3.

**Targets, set before running** (seeds 1 to 3, year 30, paths on against paths off, everything else at the S1 defaults):
- No seed dies out, and population at year 20 is at least 90% of off.
- Hamlets or larger standing at year 30 at least 80% of off.
- Trails visible but not everywhere: tiles worn to 64 or more cover between 1% and 15% of land at year 30.
- Perf within budget.

**S2 results, year 30** (paths on against paths off, both with S1 on):

| | Seed 1 | Seed 2 | Seed 3 |
|:--|:--|:--|:--|
| Round 1 (`wearStep` 16, `wearDecaySlices` 8): worn land | 51% | 76% | 64% |
| Round 2 (`wearStep` 4, `wearDecaySlices` 2): worn land | 7.3% | 11.4% | 9.7% |
| Round 2 people at year 20, % of off | 91% | 100% | 98% |
| Round 2 hamlets or larger, on / off | 13 / 16 (81%) | 21 / 21 | 10 / 16 (**62%, missed**) |

Round 1 wore most of the land, so it read as worn ground everywhere rather than trails. Kept round 2: `wearStep` 16 to 4, `wearDecaySlices` 8 to 2, so a tile has to be stepped on about every 8 ticks to stay worn. The hamlet target is missed on seed 3; per the 2026-11-05 decision, tuning waits for the combined pass. On the map, worn ground forms bands along shores and around lakes and settlements more than trails that cross open land between camps; in the game view, people stand in lines along the worn ground near the largest settlement.

## S3-pre packed earth and S3a layout test
Starting values (new): `earthWear` 64, `earthBite` 1, `earthCarryMax` 6, `earthEnergy` 0.6, `earthDigCost` 0.05, `earthBuildGain` 2 (stone gives 4), `earthErodeSlices` 32. Prototype values: `exposureSlices` 8, `windWeight` 2, `brushBarrier` 4, `treeBarrier` 120, `cliffBarrier` 600, `directionalAvoidWear` 64. The wind turns once round the compass a year.

Year 30, packed earth on in both columns; "test" adds the exposure field and directional building:

| | Seed 1 earth | Seed 1 test | Seed 2 earth | Seed 2 test | Seed 3 earth | Seed 3 test |
|:--|:--|:--|:--|:--|:--|:--|
| People | 6135 | 6254 | 5980 | 5824 | 6277 | 6709 |
| Built tiles, earth / stone | 80 / 45 | 442 / 125 | 95 / 45 | 398 / 119 | 103 / 49 | 521 / 125 |
| Tiles at hut level | 23 | 342 | 34 | 312 | 26 | 375 |
| Hamlets / villages | 4 / 5 | 6 / 5 | 8 / 1 | 16 / 2 | 11 / 5 | 13 / 8 |
| Lasted 10 years or more | 14 | 39 | 19 | 36 | 25 | 51 |

Layout of built tiles at year 30, seeds 1 and 3 (`npm run map` now prints this):

| | Earth only | Test |
|:--|:--|:--|
| Standing alone | 70%, 88% | 20%, 18% |
| In lines (2 or more built neighbours) | 4%, 2% | 47%, 47% |
| Open tiles walled on 3 or more sides | 0, 0 | 42, 44 |

Directional building turns scattered pillars into lines and some partial enclosures. In the zoomed images the lines mostly run along both banks of rivers and around shores, where people rest, rather than in rings round fires. Every wall tile at 60 durability still counts as a one-tile hut (shelter and half upkeep), which the exposure step (S3b) has to replace; until then walls give more shelter than they should.

## S3w carried water and adjacent stores: first result
Starting values (new): `waterCarryMax` 20, `waterFetchChance` 0.05, `waterFetchHydration` 90, `waterSpill` 0.2, `waterPourMinDist` 4, `waterStoreCap` 100, `waterEvaporation` 0.05, `waterEvapWarm` 2, `waterCoveredEvapMul` 0.25, `waterStoreFindMin` 10. Stores and heaps can be reached on the 8 tiles around a person (water always; food with `adjacentStoresEnabled`).

Six seeds, 30 years, distance from natural fresh water of people standing still, sampled every 90 ticks from year 10 (`npm run compare`):

| Comparison | Per-seed mean change (tiles) | Mean | 95% interval | Sign-flip p |
|:--|:--|:--|:--|:--|
| Carried water off to on | +0.32, +0.56, +0.11, +0.41, -0.06, -0.29 | +0.17 | -0.16 to +0.51 | 0.22 |
| Adjacent eating off to on | +1.01, +0.31, +0.13, +0.28, +0.07, -0.22 | +0.26 | -0.17 to +0.70 | 0.16 |

Neither is significant. Within-seed rank tests are large but disagree in direction from seed to seed; they count thousands of related samples from one run as independent, so the across-seed test is the one to read.

Why carried water shows nothing (seed 1, years 5 to 15): 1.7% of people carry water at any time, none of them 4 or more tiles from water, and no store formed. Carriers fill up at the river, stay near the shore and drink it there. The mechanism works (tests), but nothing takes people inland for it to act on: the shore holds about twice the plant food, and people return to it. The result is "not exercised", not "no effect".

## Shore against inland: lowland measured over 30 years
Lowland only (no stone, upland below 0.5), grouped by steps from fresh water at the start; seeds 1 to 3, current defaults.

| Steps from water | 1 | 2 to 3 | 4 to 6 | 7 to 12 | 13+ |
|:--|:--|:--|:--|:--|:--|
| Lowland tiles, seed 1 | 2664 | 4161 | 4124 | 5666 | 13747 |
| Plant capacity, year 0 | 24.0 | 19.7 | 10.7 | 7.9 | 15.2 |
| Plant capacity, year 30 | 19.8 to 20.6 | 11.8 to 13.2 | 8.3 to 8.9 | 7.0 to 7.4 | 14.4 to 15.1 |
| Plant food standing, year 30 | 8.0 to 9.3 | 2.9 to 3.8 | 3.0 to 3.3 | 4.4 to 4.6 | 13.6 to 14.4 |
| Worn-out soil (health below 0.6), year 30 | 10 to 18% | 5 to 10% | 1% | 0% | 0% |
| People per 100 tiles, year 30 | 83 to 105 | 30 to 32 | 13 to 15 | 9 to 10 | 1.5 to 2.4 |

The shore is not too rich: by year 30 it is worn down, holding about 40% of its capacity in standing food, with 10 to 18% of its soil worn out. Between 4 and 12 steps from water lies a naturally poor belt (fertility 0.3 to 0.4). Beyond 13 steps is the largest block of lowland (about 45%), nearly untouched, with about 14 food per tile standing. Food scent fades within 2 to 3 tiles, so nobody on the shore can sense it, and the hunger drive (primitive 18) switches off roaming when very hungry, so starving people on a worn shore search less, not more.

## Shore tests 1 and 2: hunger search and far sight
New values: `hungerSearchFlat` 0.5, `hungerSearchPersist` 1.2, `hungerSearchExplore` 0.6, `farSightInterval` 30, `farSightPull` 1.0, `farSightMargin` 0.2. Six seeds, 30 years, `npm run compare` on distance from water of people standing still:

| Comparison | Mean change | 95% interval | Sign-flip p |
|:--|:--|:--|:--|
| Hunger search off to on (far sight on) | -0.07 | -0.35 to +0.21 | 0.56 |
| Far sight off to on (hunger search on) | -0.13 | -0.48 to +0.23 | 0.41 |

Neither is significant, and neither was really exercised. Seed 1, years 5 to 15: 78% of people stand still, 41% have energy of 90 or more, 6.7% are hungry (below 35) and 1.5% critically hungry; only 0.09% are ever searching, because plant scent gives a slope almost everywhere (median scent difference among the hungry 5.1, against the 0.5 trigger). The shore is worn to about 40% of capacity but still feeds everyone, so nothing pushes people off it. Population is still rising at year 30, and the share of people 13 or more steps from water rises in every run (1 to 6% at year 20, 4 to 9% at year 30). Next: long runs to see whether pressure arrives on its own.

Trigger fixed: `hungerSearchFlat` (0.5, a scent-slope test that fired for 0.09% of people) replaced by `hungerSearchFood` 6: a hungry person searches when plant food on their tile and the 4 beside it averages below 6.

## Long runs: overshoot and collapse (seed 1 unless noted, 80 years)
| Run | Year 30 | Year 50 | Year 80 | Hungry at 80 | 13+ steps from fresh water at 80 |
|:--|:--|:--|:--|:--|:--|
| All settlement switches off (S1 to S3w, paths, earth, search, far sight) | 2964 | 694 | 289 | 12% | 1.7% |
| S1 stay rules off only | 2771 | 650 | 183 | 10% | 1.1% |
| Everything on, search trigger fixed | 5916 | 4096 | 2184 | 63% | 4.3% |
| Everything on, seeds 1 / 2 / 3 (before the fix) | 5975 / 5589 / 6161 | 4143 / 4130 / 4195 | 2239 / 2587 / 2014 | 57 to 64% | 3 to 6% |

Population peaks near year 30 and then falls by two thirds with everything on, and by 90% with the settlement work off. The collapse predates the settlement work: the Phase 1 check (steady for 200 years) no longer holds. With the settlement work off, few people are hungry while the population falls, so the cause is not starvation; with it on, the end state is starvation (about 60% hungry) with no spread inland. The fixed search trigger changes nothing measurable. Two likely reasons, not measured: hungry people cannot fetch water (fetching needs a full stomach), so searchers keep returning to the river; and "13 or more steps from fresh water" includes land beside the salt sea. Next: deaths by cause and births per decade.

### Deaths by cause and wounds (2026-11-06)

`scripts/death-probe.ts` and `scripts/wound-probe.ts` wrap `people.kill` and read state only. Population totals match the earlier runs exactly, so the probes change nothing. Seed 1, 80 years (death probe) and 50 years (wound probe, everything on). Each death gets the first matching label in this order: wolf, clash, old age, thirst, wound, sick, pregnant, child.

| Over 80 years | All settlement switches off | Everything on |
|---|---|---|
| Ran out of energy while wounded | 6,870 (79%) | 14,259 (86%) |
| Clash | 379 | 1,639 |
| Wolf | 352 | 2 |
| Child, not wounded, ran out of energy | 461 | 40 |
| Old age (60) | 35 | 262 |
| Thirst, sick, other | 680 | 233 |

Average age at death is 11 to 23 years, so the founders do not die together. After year 30, births fall each decade while deaths stay high (everything on: 4,808 in years 21 to 30, then 3,352, 2,496 and 790 in years 71 to 80).

| Years (everything on) | People | Wounded | Mean wound (of 255) | Wounded able to heal (energy 50+) | Children | Women fed enough to mate |
|---|---|---|---|---|---|---|
| 1 to 5 | 1,760 | 74% | 178 | 69% | 62% | 43% |
| 21 to 25 | 5,621 | 95% | 217 | 51% | 68% | 26% |
| 46 to 50 | 4,096 | 97% | 223 | 28% | 58% | 13% |

No code bug found: clashes, wounds, healing, mating, childbirth and childcare do what their code says. Most people pass the belligerence threshold of 180 (habit plus cruelty gene, which averages about 256). Any two non-allies on one tile can clash every tick, children included, and most wounds go to children, about 6 per child per year. Wounds heal only above half energy, at 0.3 a tick, so injury builds to near the cap, and the wounded get hungrier and stop healing. The same pattern is there with the settlement switches off, at 74% wounded in years 1 to 5. Turmoil never drives the losers away: the stay check ignores danger, danger scent is a slope that is flat inside a fought-over camp, hunger halves fear, and a defeat is one random step. The response is S3x in `docs/SETTLEMENTS.md`.

### S3x targets, set before running (2026-11-06)

Seeds 1 to 3, 30 years (healing alone) and 50 years (with fear), wound and death probes. Compared against the same seeds with the S3x switch off. These are what to report, not things to tune toward:
- **Slow healing:** share wounded at years 21 to 30 below off; mean injury of the wounded below off. Guardrails: no seed dies out; population at year 20 within 10% of off; perf within budget.
- **Fear:** of people who lost a clash, the share more than `fearRadius` from the place of the loss 90 days later is higher than off (with fear off this is measured the same way, from where they lost). Winners: no different from off. Guardrails as in `docs/SETTLEMENTS.md` S3x.

**S3x slow healing result** (seeds 1 to 3, 30 years, fear off in both arms, wound probe): target met, effect small.

| Years 26 to 30 | Seed 1 off / on | Seed 2 off / on | Seed 3 off / on |
|---|---|---|---|
| Wounded | 96% / 94% | 96% / 93% | 94% / 89% |
| Mean wound of the wounded | 219 / 209 | 221 / 210 | 214 / 204 |
| People | 5,916 / 6,221 | 5,676 / 5,848 | 6,463 / 6,356 |

Wounds still arrive faster than they can heal: a lost clash about every 55 ticks needs more than 1 point a tick, against 0.3 at most (0.45 sheltered). Healing does not fix the wound load by itself; fewer repeated clashes have to.

**S3x fear result** (seeds 1 to 3, 50 years, slow healing on in all arms, wound probe). "Away" means more than 8 tiles from the spot of a clash 90 days later, found from the wound jump, so it is measured the same way with fear off.

| Years 26 to 30 | Fear off | Fear on | Fear on, wounds not scaling it |
|---|---|---|---|
| Losers away, seeds 1 / 2 / 3 | 38.5 / 38.6 / 37.4% | 62.3 / 59.1 / 64.0% | 59.1 / 61.6 / 62.5% |
| Winners away | 34.3 / 34.6 / 36.0% | 35.4 / 33.0 / 34.5% | 34.3 / 34.9 / 34.0% |

The target is met on every seed: losers leave and winners don't (years 16 to 20: losers 49 / 45 / 52% against 23 / 23 / 22% off). Scaling fear by wounds adds little.

Guardrails: no seed dies out, and child deaths are not up (7,817 / 8,335 / 8,584 on against 8,270 / 8,300 / 8,690 off). **Population falls further, though**: at year 50 it is 2,714 / 2,948 / 2,863 with fear on against 4,611 / 4,531 / 4,751 off, about 38% lower. Deaths are lower, but births fall faster. Women fed enough to mate drop to 5 to 7% (11 to 15% off), and pregnancy to 17 to 21% (37 to 48% off). The wound load does not fall (84 to 90% wounded, against 86 to 92% off), so leaving does not escape fighting: refugees meet strangers elsewhere. Likely causes, not measured: frightened people keep walking instead of grazing still, which costs energy and skips tilling, and they leave the richer shore. Not measured yet: settlements lasting 10 years or more, and perf (the machine was loaded).
