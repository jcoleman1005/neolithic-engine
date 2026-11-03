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
