# Rules catalogue (rebuild draft)

A flat list of simple rules for a from-scratch simulation. Each rule is local (an entity looks only at itself and its neighbours), one line, and testable on its own. Nothing names an outcome: no rule says "flock", "hunt", "form a tribe" or "speciate". Those are what we hope to see, and we measure for them.

Tags: **[core]** minimal first build · **[+]** add once core runs · **[later]** needs earlier layers. Each rule gets a config switch so we can run on/off arms.

**Status (2026-10-31):** the `[core]` rules are built in `src/core/` (stage 1), and so are recurrent memory (179), heading and last-action sensing (135, 136), tag similarity (107) and the colour tag (98) (stage 2; see `docs/STATUS.md`). Rule 18 gained a minimum bite (EAT is legal only where at least `minBite` food remains), found necessary when founders sat on depleted cells.

**Build order is a natural progression, not a gate.** Each stage rests on the one before it: corpses lead to carrying, carrying to giving, giving to trade; accumulated damage and shared corpses lead to packs and defense. If a stage shows that an earlier one is missing something, we go back.

**Deferred, not dropped (agreed 2026-10-30):** thermal and heat costs (39), disease (191), weather and rain (23), teaching (182) and cultural lineages (184). The cut holds only while none of them is needed for emergence. If a run shows a missing one blocks a behaviour (for example, no migration pressure without temperature, or no group-size limit without disease), it comes back as a hook and the reason goes in `docs/decisions.md`.

## A. Time and space
1. The world is a W×H grid of cells; the edges are walls, or wrap (a switch).
2. Time advances in discrete ticks. [core]
3. All entities decide from one snapshot taken at the start of the tick, then all actions resolve together. [core]
4. Conflicts (two movers, one cell) are broken by a seeded random draw. [core]
5. Only the seeded PRNG is used; the same seed gives the same world. [core]
6. A cell holds at most one organism. [core]
7. A cell has terrain: open, wall, or water. Walls block; deep water blocks unless swimming. [core]
8. Each cell has a fixed fertility from a smooth noise map. [core]
9. Each cell has a temperature that varies with a slow noise map plus a season cycle. [+]
10. Each cell has a roughness that scales move cost. [+]
11. Each cell has cover that shelters from cold and from sight. [+]
12. Neighbourhood is 8 cells; a diagonal move costs √2 times a straight one. [core]
13. A diagonal move cannot cut a wall corner. [core]

## B. Resources
14. Plants are the only source of energy entering the world. [core]
15. Each cell holds a food stock between 0 and a cap set by its fertility. [core]
16. Food regrows toward the cap at a rate that falls as the stock nears the cap (logistic). [core]
17. Food above a threshold seeds neighbouring empty cells. [+]
18. Eating takes food from a cell; one bite takes at most `biteSize`. [core]
19. A cell eaten to zero regrows slowly from a floor, never instantly. [core]
20. Heavily grazed cells lose fertility; rested cells recover it. [+]
21. Trampled cells lose cover and smooth in roughness; they recover when left alone. [+]
22. Seasons raise and lower the regrowth rate on a fixed cycle. [+]
23. Rain events raise regrowth in a moving patch. [later]
24. Dead organisms leave a corpse holding a share of their body energy. [core]
25. A corpse rots away over a fixed number of ticks. [core]
26. Rotting corpses fertilise their cell. [+]
27. Waste from eating fertilises the eater's cell. [+]
28. Total energy in the world is accounted for every tick: in minus out equals change in stored. [core]

## C. Body
29. An organism has energy between 0 and a maximum; zero means death. [core]
30. Every tick costs a base upkeep. [core]
31. Upkeep scales with body size to a fixed power below 1. [+]
32. Moving costs energy only if the move succeeds. [core]
33. Standing still costs only upkeep. [core]
34. An organism has an age in ticks. [core]
35. Organisms start small and grow while their energy is above a threshold. [+]
36. Only grown organisms can reproduce. [+]
37. Upkeep rises with age after a threshold (senescence). [+]
38. Larger bodies store more energy and move more slowly through rough terrain. [+]
39. Cold costs energy in proportion to temperature below a comfort band; heat likewise above it. [+]
40. Fat is a stored share of energy; it adds drag and insulates. [later]
41. Damage is a scalar on the body: it raises upkeep and is healed at an energy cost. [later]

## D. Senses
42. Senses are local: the 8 neighbour cells plus the current cell. [core]
43. Each sensed cell reports food level, occupant presence, terrain, and the occupant's tag. [core]
44. Own state is sensed: energy fraction, age fraction, recent success of the last action. [core]
45. There is no global map and no shared memory. [core]
46. Sensing radius is a gene; a bigger radius costs upkeep. [+]
47. Walls and bodies block sight past them. [later]
48. Scent: each organism deposits a decaying trace on its cell, drifting with wind. [later]
49. Signals: an organism may emit a signal that is sensed by others within range next tick. [+]
50. Signals carry a small number of channels with no built-in meaning. [+]
51. Emitting a signal costs energy. [+]
52. Last action's outcome is remembered for a few ticks (a short memory). [+]

## E. Actions (each is a legal move; a controller picks one per tick)
53. MOVE to an adjacent free cell. [core]
54. EAT from the current cell. [core]
55. STAY. [core]
56. REPRODUCE by cloning into an adjacent free cell at a cost. [core]
57. SIGNAL. [+]
58. GIVE food to an adjacent organism. [+]
59. ATTACK an adjacent organism. [+]
60. EAT a corpse. [core]
61. MATE with an adjacent organism that also chooses MATE the same tick. [+]
62. LEAP over an adjacent organism to the cell beyond. [later]
63. SQUEEZE past an adjacent organism that stays still. [later]
64. Illegal actions are impossible, not penalised; the controller only scores legal ones. [core]

## F. Control
65. A controller maps sensed inputs to one score per legal action; the top score wins, ties are random. [core]
66. The controller is a small neural net whose weights are the genome. [core]
67. Hidden size is fixed at first; it may grow by mutation later. [later]
68. There is no learning during life unless we add and name it. [core]
69. A hunger term is an input, not a hard-coded override. [core]
70. Policy has no built-in priorities: eat-when-hungry has to be found by selection. [core]

## G. Reproduction and inheritance
71. A clone costs a fixed energy investment; the parent must keep a reserve. [core]
72. The child inherits the parent's genome with mutation. [core]
73. Each weight mutates with small probability by a small gaussian step. [core]
74. Each trait gene mutates by a small step and is clamped to its range. [core]
75. The child starts with energy equal to the investment, minus a birth loss. [core]
76. Mating takes one gene copy per locus from either parent, then mutates. [+]
77. Investment per child is a gene. [+]
78. Reproduction threshold is a gene. [+]
79. A child appears adjacent to the parent, or up to `dispersal` cells away (a gene). [+]
80. Mate pairs whose genomes differ by more than a distance produce inviable children with rising probability. [later]
81. Mate choice has no built-in preference; any preference is a weight. [+]
82. Eggs: a laid egg holds energy, incubates for a number of ticks, then hatches. [later]
83. Clutch size is a gene. [later]

## H. Genes (heritable body parameters; each has range, founder value, mutation step, and a cost)
84. Size. 85. Sensing radius. 86. Metabolic rate. 87. Digestive efficiency. 88. Energy cap.
89. Dispersal distance. 90. Diet (plant yield vs meat yield, with a trade-off). 91. Growth duration.
92. Armour (slows attackers' kills, costs upkeep and movement). 93. Toxicity (hurts eaters of the body). 94. Stealth.
95. Swim ability. 96. Memory span. 97. Signal strength. 98. A colour tag with no function of its own.
99. Every gene must have an upkeep cost or a trade-off, or it will just run to its limit. [core]
100. A gene's effect must pass the energy ledger. [core]

## I. Interaction
101. Attack succeeds with a probability from the attacker's size and the target's armour. [+]
102. A kill leaves a corpse; the killer gets energy only by eating it. [+]
103. Eating a toxic corpse or body harms the eater unless it has the matching detox. [later]
104. A hunter pays an energy cost per attack whether or not it succeeds. [+]
105. GIVE moves food only; energy never moves directly between organisms. [+]
106. Parents and children may trade places; strangers may not. [later]
107. Kin are recognised only by tag similarity, which can be wrong. [+]

## J. Population, environment, and perturbation
108. There is no cap on population except the food supply. [core]
109. No immigration by default. [core]
110. Extinction is allowed. A world with no organisms stays empty. [core]
111. Optional: spontaneous founders at a very low rate (off by default). [+]
112. Disasters (a food crash, a cold snap, a barrier appearing) are scheduled events, off by default. [later]
113. Walls can be placed or removed by the user. [core]
114. Food patches can be placed by the user. [core]

## K. Observers (never change the world)
115. Population, births, deaths, mean energy, mean age per tick. [core]
116. Gene histograms and trends. [core]
117. Lineage: parent links for every organism, to reconstruct pedigrees. [+]
118. Species: cluster genomes by distance, track clusters over time. [+]
119. Event feed: first kill, first mating, mass die-off, new cluster. [+]
120. Behaviour log: action distribution per organism and by context. [core]
121. Heatmaps: occupancy, deaths, feeding, signals. [+]
122. Spatial statistics: clustering index, nearest-neighbour distance. [+]
123. Each observer is proven not to change the state hash. [core]

## L. Engineering rules for the rebuild
124. State hash: equal hashes must continue identically. [core]
125. Every rule has a switch; all switches off gives the minimal world. [core]
126. Snapshot and restore bit-identically. [core]
127. Experiments compare arms on matched seeds; null results are written down. [core]
128. Tests check mechanisms and invariants, never that a behaviour appears. [core]
129. A new rule that fails the energy ledger is not merged. [core]
130. Parameters tuned to coax an outcome get logged with why. [core]

## M. Enabling primitives for complex behaviour
Each group below lists what a behaviour needs to be physically possible. No rule says "hunt in packs" or "farm"; each only makes the behaviour possible and leaves selection to find it. Tags as before.

### M1. Cooperative predation and flocks
131. Prey can be bigger than one predator can kill: a kill needs accumulated damage across ticks, and damage heals slowly. [+]
132. Damage from several attackers in the same tick sums. [+]
133. Prey fight back: an attacked organism's attackers risk damage scaled with its size and armour. [+]
134. A corpse holds more food than one bite; several feeders can share it, `biteSize` per organism per tick. [+]
135. Sensing reports neighbours' last move direction (heading), not only presence. [+]
136. Sensing reports whether a neighbour is attacking or fleeing (last action category). [+]
137. Sensing range is wide enough to see a handful of nearby organisms (radius 3 to 5, costed). [+]
138. Moving into a cell vacated by a neighbour the same tick is allowed (trains and columns can move together). [+]
139. A fast organism can outrun a slow one: speed gene = chance of an extra step, costed. [later]
140. Signal channels can be heard at range and are decoded by the receiver's weights only (alarm, rally, none). [+]
141. A kill gives the killer first access to the corpse for a few ticks (a feeding lock), so sharing needs a rule the controller can choose. [later]

### M2. Defense
142. Adjacent allies (same tag similarity) lower the hit chance of an attack on their neighbour (shielding). [+]
143. A body blocks movement and sight, so a line of bodies is a wall. [+]
144. Retaliation is a legal action only against an organism that attacked this one in the last N ticks. [+]
145. Armour and toxicity (84 to 94) cost upkeep, so defense must pay for itself. [+]
146. Hiding: an organism in a cell with cover is harder to sense, by a fraction of the cover. [+]
147. A fled-from attacker cannot sense a target outside its radius; escape is just breaking contact. [core]
148. Alarm signals (49 to 51) let a warned neighbour act before the attacker arrives. [+]

### M3. Items, ownership and trade
149. Organisms can carry up to `carryCap` units of items; carrying costs movement energy. [+]
150. Two or more resource kinds exist: energy-food and a second material (for example minerals, fibre, seeds). [later]
151. The second resource is needed only for something optional (reproduction cost, building, armour) so energy stays the one need. [later]
152. The two resources are placed in different regions, so local scarcity exists. [later]
153. PICK UP and DROP move items between a cell and the carrier. [+]
154. GIVE hands an item to an adjacent organism; the receiver chooses nothing, so exchange is two sequential gifts. [+]
155. An item has an owner tag; taking an owned item is legal (theft is possible) and is not penalised by the engine. [later]
156. Organisms can remember a limited number of individuals (identity tag) and the net outcome of past encounters (gifts received, attacks received). [later]
157. Remembered outcomes are inputs, so reciprocity and grudges can be found by selection and are never coded. [later]
158. Individuals have a stable identity token that is sensed on adjacent organisms. [later]
159. Travel between a resource region and a different one costs energy, so a trade partner can save a trip. [later]

### M4. Farming
160. Seeds are items. A carrier may drop a seed on an empty cell with enough fertility; it sprouts into a plant. [later]
161. A sprout needs time and soil, and is eaten by anyone. [later]
162. TEND is a legal action on a plant in the current or adjacent cell: it raises growth and lowers weed pressure, at an energy cost. [later]
163. Weeds: cells with plants draw weed pressure that slows growth unless tended. [later]
164. Planted cells keep the planter's owner tag as a faint mark (rule 155), without any enforcement. [later]
165. Harvest is simply EAT, but a cell harvested before maturity yields less. [later]
166. A walled-off cell is protected from grazers (see build rules, 167). [later]

### M5. Building and persistent structures
167. BUILD places a structure on the current or adjacent cell: wall, mound, nest, or store. It costs items and energy. [later]
168. DIG removes a structure or lowers terrain; it yields items. [later]
169. Structures have health and decay slowly unless repaired. [later]
170. A nest raises the survival of eggs and young in its cell and lowers cold costs. [later]
171. A store holds items and food in its cell, with a decay rate lower than open ground. [later]
172. A wall stops movement, sight and some weather. [later]
173. Structures are sensed by the same cell-inputs as terrain. [later]

### M6. Marks and communication that persist
174. MARK writes a short tag onto the current cell. It decays slowly, and other organisms can read it. [+]
175. A mark has no built-in meaning; it is a state that the controller reads. [+]
176. Marks can be overwritten; the newest wins. [+]
177. Scent (rule 48) is a free passive mark; MARK is a costed deliberate one. [later]
178. Signals and marks can cross a region, so the information is local in space and time. [+]

### M7. Learning, memory and culture
179. The controller has recurrent state: a vector carried from tick to tick. [+]
180. Lifetime learning: a reward-driven weight update within a life (for example a simple Hebbian rule with an energy-gain reward). Changes are not inherited. [later]
181. Imitation: an organism's weights can be nudged toward those of an adjacent organism that recently gained energy. [later]
182. Teaching: GIVE of a marker instead of an item transmits a bias vector to the receiver. Costed. [later]
183. Social traits (cooperative, aggressive) are never an enum; they are read off behaviour logs. [core]
184. Cultural lineages are tracked by a variant id carried by imitation, as a distinct line from genetics. [later]

### M8. Social structure
185. Parental care: parents may keep adjacent children fed (GIVE) and shielded. [+]
186. Kin recognition is imperfect (rule 107), so cheaters can exist. [+]
187. Groups are not assigned. A group is a cluster of organisms near each other with similar tags over time. [core]
188. Division of labour can emerge only if different bodies pay different costs. Size, speed, armour, carry and sensing already differ per gene. [+]
189. Punishment is ATTACK on a remembered cheater (rule 157). The engine does not label it as such. [later]
190. Group size has costs: crowding raises disease, wear and local food draw. [+]
191. Disease: transmission by adjacency, with infection cost and recovery. Dense groups pay for contact. [later]

### N. What this requires beyond rules
- **A richer brain.** The current 6-hidden-unit network cannot carry multi-step plans such as plant, wait, tend and harvest. We need recurrent state (179) and more input channels. The hidden size should be able to grow.
- **A longer clock.** Farming and trade pay off only if organisms live hundreds of ticks. Lifespan has to be long relative to the plant growth time.
- **A bigger population.** Group behaviour needs hundreds to thousands of organisms and a world large enough for regions to differ. That is an engine speed budget.
- **A way to measure it.** Observers for flock cohesion, kill participation, gift reciprocity, plant-then-harvest sequences, structure counts, and mark use. Each must ship with a control arm (a shuffled or random-action baseline) so chance patterns are not read as behaviour.
- **Honest expectations.** None of this is guaranteed to appear. We are building the conditions. Farming and trade are the hardest because they need delayed payoff, so we should expect to find out whether they appear, and report null results.

## Where emergence should come from (hypotheses, not goals)
- Pack hunting from 131 to 138, 140 and 187.
- Defensive groups from 142, 143, 148 and 187.
- Trade from 150 to 159 with 156 and 157.
- Farming from 160 to 166, with 149 and 153.
- Settlements from 167 to 173, 174 and 185.
- Culture from 179 to 184.
- Clumping or herding from rules 16, 17, 43, 49 and 107 together.
- Territories or avoidance from 21, 48 and 59.
- Boom-and-bust cycles from 16, 22 and 71.
- Predator-prey arms races from 92 to 94 and 101 to 103.
- Species splits from 76, 80, 81 and 98.
- Migration from 20, 22 and 108.
