# Scoring Framework

How nego measures a negotiation session. This is the reference spec: a developer should be able to reimplement the engine from this document plus `src/lib/content/schema.ts` and `src/lib/types.ts`.

**Core principle — determinism boundary.** A deterministic engine owns every fact, constraint, offer, threshold, and number. The LLM only (a) verbalizes decisions the engine already made, and (b) writes clearly-labeled subjective coaching. If a number appears anywhere in the product, the engine computed it.

Worked examples throughout use `content/scenarios/used-camera-001.json`.

---

## 1. The utility model

Each role (player and AI) has `preferences`: per offer-field, a `weight` plus either `best`/`worst` (number fields) or `option_values` (select fields).

```
utility(offer) = Σ over fields f of  w_f × value_f(offer[f]) × 100        // 0–100 scale

number field:  value_f = clamp((value − worst_f) / (best_f − worst_f), 0, 1)
select field:  value_f = option_values_f[option]                          // authored 0..1
```

- `w_f` are **normalized at load time** so they sum to 1 (authors need not make them sum to 1).
- `best < worst` is legal for number fields (e.g. a buyer's price): the formula flips direction automatically because `(best − worst)` is negative.
- Values outside `[worst, best]` clamp to 0 or 1 — utility is flat beyond the authored anchors.

### Worked example — used-camera

Offer space: `price` (number, $300–600, step 5) and `extras` (select: `none` / `battery_bag` / `full_kit`).

| | weight | number anchors | option_values |
|---|---|---|---|
| **Buyer** price | 0.85 | best 380, worst 550 | — |
| **Buyer** extras | 0.15 | — | none 0, battery_bag 0.6, full_kit 1 |
| **Seller (Sam)** price | 0.90 | best 550, worst 380 | — |
| **Seller (Sam)** extras | 0.10 | — | none 1, battery_bag 0.5, full_kit 0.15 |

Weights already sum to 1 for both roles, so normalization is a no-op here.

**Deal: $430 + battery & bag**

```
Buyer:  price value = clamp((430 − 550) / (380 − 550), 0, 1) = 120/170 = 0.7059
        utility     = 0.85 × 0.7059 × 100  +  0.15 × 0.6 × 100
                    = 60.0 + 9.0 = 69.0

Sam:    price value = clamp((430 − 380) / (550 − 380), 0, 1) = 50/170 = 0.2941
        utility     = 0.90 × 0.2941 × 100  +  0.10 × 0.5 × 100
                    = 26.5 + 5.0 = 31.5
```

Handy closed forms for this scenario (camera-only, i.e. extras = none):

```
Buyer utility  U = 0.5 × (550 − price)            →  price = 550 − 2U
Sam utility    U = 0.5294 × (price − 380) + 10    →  price = 380 + 1.889 × (U − 10)
```

### Role anchors (authored on the same 0–100 scale)

| Anchor | Meaning | Buyer | Sam |
|---|---|---|---|
| `batna.utility` | value of walking away (all-in judgment: fallback deal, risk, hassle) | 45 | 20 |
| `reservation_utility` | minimum acceptable deal; below this, walking is rational (≈ BATNA) | 45 | 22 |
| `target_utility` | ambitious-but-realistic goal | 70 | 68 |

Coherence check: buyer reservation 45 ⇔ camera-only price 550 − 2×45 = **$460** — exactly the "hard budget cap" in the private brief. Buyer target 70 ⇔ **$410** camera-only, or **$428** with battery & bag. Sam's target 68 ⇔ **$489.60** camera-only; Sam's reservation 22 ⇔ **$402.70** camera-only.

---

## 2. Opponent policy (numbers that scoring depends on)

Full authoring detail is in `docs/scenario-design.md`; the mechanics that produce outcome numbers:

**Acceptance threshold.** Starts at the AI's target utility (possibly variation-sampled) and decays each player-turn:

```
threshold(t) = max( reservation,
                    target − t × concession_rate × (target − reservation)
                           + Σ threshold_delta of events fired by turn t )
```

The AI **accepts** a standing player offer iff `AI_utility(offer) ≥ threshold(t)`. The threshold never goes below reservation — the AI never takes a deal worse than walking.

Used-camera (base params: target 68, reservation 22, `concession_rate` 0.12 → decay 0.12 × 46 = 5.52/turn; event `another_buyer` fires at turn 6 with `threshold_delta` +4):

| player turn t | threshold | ≈ min acceptable camera-only price |
|---|---|---|
| 0 | 68.0 | $490 |
| 2 | 57.0 | $469 |
| 4 | 45.9 | $448 |
| 6 | 34.9 + 4 = 38.9 | $435 |
| 8 | 27.8 | $414 |
| 10 | 22.0 (floored) | $403 |

**Counter-offers.** The engine scans the discretized offer space for offers whose AI-utility is near a desired level (the current threshold, or `opening_demand × 100` for the AI's first offer), then among candidates within tolerance (v1: ±3 utility points) picks the one that **maximizes PLAYER utility**. This produces automatic logrolling: the AI packages in extras that are cheap for it but valuable to the player. Personality knobs: `opening_demand` (0..1, how close the first offer is to the AI's best corner, utility 100), `concession_rate`, `patience` (player turns before the AI opens if the player hasn't), `warns_before_walking`.

Used-camera: `opening_demand` 0.85 → first-offer level 85 → camera-only price 380 + 1.889 × 75 ≈ **$522** — matching the $520 listing.

---

## 3. Deterministic outcome analysis (`DealAnalysis`)

Computed by grid enumeration, no LLM involved.

**Grid.** Every number field stepped by its `step` over `[min, max]`; select fields enumerate options. Used-camera: 61 prices × 3 extras = 183 cells. If the product of cells exceeds a cap (v1: 50,000), coarsen number steps proportionally or sample uniformly; record that the max is approximate.

Over the grid, compute:

- **`max_joint_utility`** = max over all cells of `player_utility + ai_utility`, ZOPA membership not required. Used-camera: joint is maximized at price ≥ $550 with `full_kit` → 0 + 15 (buyer) + 90 + 1.5 (Sam) = **106.5**. (Corner maxima outside the ZOPA are normal; joint-value scoring is a ratio, see §4.2.)
- **`zopa_existed`** = does any cell give both sides ≥ their reservation? Used-camera: camera-only $405–$460 all qualify (and more with extras) → true.
- **`pareto_improvement`** (deal reached only) = a cell where both utilities ≥ the final deal's and at least one is strictly higher; report the best such cell (max joint), else null. Example: final deal ($430, none) → buyer 60.0, Sam 36.5. Cell ($440, battery_bag) → buyer 64.0, Sam 36.8: both better, so it's reported — "a better package was available."
- **`walk_was_reasonable`** (player walked only) = true iff the best offer the AI actually put on the table had player utility **below** the player's reservation. Walking from a ≥-reservation standing offer is undisciplined; walking when nothing acceptable was ever offered is disciplined.
- Deltas: `player_vs_reservation`, `player_vs_target`, `player_vs_batna` (final utility minus each anchor; null on no deal).

---

## 4. Score categories

Six `ScoreItem`s, each 0–100, each labeled with its `basis` (`"objective"` = pure arithmetic on engine facts; `"rule_based"` = deterministic heuristic encoding a coaching judgment). Every item carries a plain-language `explanation`.

Constants marked **v1** are reference values — tune freely, but keep them in the engine, never the LLM.

### 4.1 Personal outcome — `objective`

Deal reached, final player utility `u`:

```
score = 100 × clamp((u − reservation) / (target − reservation), 0, 1)
```

Used-camera: deal $430 + battery & bag → u = 69 → 100 × (69 − 45)/(70 − 45) = **96**. Deal at $460 camera-only → u = 45 → **0** (you merely matched walking away).

No deal (scored vs BATNA — v1 constants):

| Outcome | Score |
|---|---|
| Player walked, `walk_was_reasonable` = true | 70 (you preserved your BATNA with discipline) |
| Player walked, unreasonable (an ≥-reservation offer was on the table) | 15 |
| Turn limit hit, an ≥-reservation offer had been available | 10 |
| Turn limit hit, nothing acceptable was ever offered | 55 |
| AI walked (player pushed it below reservation repeatedly) | 20; 40 if the player's offers were never below AI reservation |

### 4.2 Joint value creation — `objective`

```
deal:     score = 100 × (player_utility + ai_utility) / max_joint_utility
no deal:  score = 100 if zopa_existed = false (correctly avoided a value-destroying deal), else 0
```

Used-camera: ($430, battery_bag) → (69 + 31.5)/106.5 = **94**. ($430, none) → 96.5/106.5 = **91** — the missed battery/bag logroll shows up here and in `pareto_improvement`.

### 4.3 Information discovery — `objective`

```
score = 100 × Σ importance of revealed hidden_info / Σ importance of all hidden_info
```

Used-camera importances: needs_cash_friday 3, low_shutter_count 2, spare_extras 2, lowball_last_week 1 (total 8). Revealing the Friday deadline + the spare extras = 5/8 = **62.5**.

### 4.4 Concession discipline — `rule_based`

All measured in the player's **own utility** over the player's offer sequence o₁…oₙ.

- **A. Ambitious start (0–40):** full credit if `u(o₁) ≥ target`; linear from reservation to target; 0 below reservation. (Buyer opening $400 camera-only → u 75 ≥ 70 → full 40.)
- **B. Monotonically shrinking concessions (0–40):** concession `cᵢ = u(oᵢ) − u(oᵢ₊₁)`. Full credit if every `cᵢ₊₁ ≤ cᵢ + ε` (v1 ε = 1 utility point); otherwise 40 × fraction of compliant adjacent pairs. Vacuously full with < 3 offers.
- **C. Never conceded against yourself (0–20):** 20 unless the player ever made a strictly-worse-for-self offer with **no intervening AI counter or rejection** since their previous offer (bidding against yourself), in which case 0.

### 4.5 Preparation quality — `rule_based`

- **Complete (0–40):** every `preparation` field filled; text fields non-trivial (v1: ≥ 15 characters). Pro-rated per field.
- **Plan consistent with brief (0–30):** for numeric prep fields with `refers_to` = the primary field, convert the role's `reservation_utility` (resp. `target_utility`) into the equivalent primary-field value holding other fields at their baseline (first select option), and check the player's number falls within tolerance (v1: ±10% of the field's span). Used-camera: derived reservation price $460, span 300 → accepted band $430–$490.
- **Opening matched plan (0–30):** the first actual offer's primary-field value within tolerance of the prep "opening" (v1: ±5% of span; ±$15 here). Skipped (credit given) if the AI opened first and the player never made an offer at their planned level a counter would allow.

### 4.6 Process / questions — `rule_based`

- **Explored before bargaining (0–50):** count player message-turns before the first offer (either side) that ask something — contain "?" or match any `reveal_topics` entry. v1: `50 × min(count, 3)/3`.
- **Topic coverage (0–50):** fraction of `hidden_info` items whose `reveal_topics` were matched by any player message during the whole session, × 50. (Coverage counts probing; §4.3 counts what was actually revealed.)

### Total

```
total = 0.25 × personal_outcome + 0.15 × each of the other five        // v1 weights
```

---

## 5. XP and skill aggregation

**XP** (v1):

```
xp = round( total × (1 + 0.25 × (difficulty − 1)) ) + (first completion of scenario ? 50 : 0)
```

Difficulty 1 → ×1.0, difficulty 5 → ×2.0. Used-camera (difficulty 1), total 80, first play → 80 + 50 = 130 XP.

**Skill categories.** Each scenario lists `concepts`. After each session, every listed concept receives a signal and updates by EWMA:

```
skill[c] ← α × signal + (1 − α) × skill[c]        // v1 α = 0.3; initialize to first signal
```

v1 concept → signal mapping (average the listed categories):

| concept | signal source |
|---|---|
| batna, reservation_point, walking_away | personal_outcome |
| anchoring | concession_discipline (its ambition sub-check dominates) |
| concessions | concession_discipline |
| logrolling, value_creation | joint_value |
| questioning, information | mean(information_discovery, process_questions) |
| preparation | preparation_quality |
| *(unmapped concept)* | total |

---

## 6. The LLM coach

Output type: `Coaching` (`src/lib/types.ts`). Always rendered under the badge **"AI coaching (subjective)"**.

**May:** interpret the transcript and name what happened; call out strengths and missed opportunities (grounded in the engine's `Observation` list and `DealAnalysis`, which it receives as context); propose 1–2 concrete example lines the player could have said; pick exactly one `concept_to_review`; reference facts the debrief already exposes (including missed `hidden_info` — the game is over).

**May NOT:** produce any evaluative number — no scores, utilities, thresholds, percentages, or dollar judgments of its own (quoting figures that appear verbatim in the transcript is fine); contradict the deterministic analysis; invent facts, offers, or events not in the transcript; present itself as objective.

**Fallback:** with no API key, a rule-based template assembles `Coaching` directly from the engine's `Observation`s (`generated_by: "template"`); the UI treats both identically.

---

## 7. Validity and limitations

Read this before treating any score as a measurement.

### Reasonably literature-backed

- **BATNA / reservation / target** as the structuring concepts of preparation and outcome evaluation (Fisher, Ury & Patton, *Getting to Yes*; Raiffa, *The Art and Science of Negotiation*).
- **First-offer anchoring** — ambitious openings correlate with better outcomes (Galinsky & Mussweiler 2001), the basis of the ambition sub-check.
- **Logrolling / Pareto efficiency** in multi-issue negotiation as the definition of value creation (Raiffa; Pruitt, *Negotiation Behavior*), the basis of joint-value scoring and pareto-improvement detection.
- **Information exchange and question-asking** predict joint gains (Thompson 1991; Weingart et al.), the rationale for discovery and process scores.
- **Concession patterns** — graduated, shrinking concessions signal a limit approaching and are standard prescriptive advice (Raiffa; Pruitt).
- **Point-scored role-play simulations** are the standard pedagogy in negotiation courses; scoring against a payoff schedule is established practice.

### Experimental product assumptions (ours, unvalidated)

- **Additive linear utility** with author-set weights and clamped anchors. Real preferences are non-linear and reference-dependent (prospect theory); our model ignores loss aversion, fairness concerns, and relationship value except where authors fake them in via weights.
- **Cross-scenario comparability** of the 0–100 scale, the category weights, all v1 constants, the XP curve, and EWMA α — chosen for feel, not validated.
- **The threshold-decay opponent** is a deliberately simple stand-in for human concession behavior. It is exploitable once understood (stall, then offer at the floor); scores measure performance against *this policy*, not against people.
- **Substring topic matching** for discovery/process rewards phrasing luck and vocabulary overlap; false negatives (unlisted synonyms) and false positives (accidental matches) both occur.
- **Rule-based heuristics** (tolerance bands, question counts, ε) are proxies for judgment, not validated psychometric measures — hence the mandatory `rule_based` label.
- **No transfer evidence.** We have not shown that improving nego scores improves real-world negotiation. Scores are valid *within the game model*.
- **LLM verbalization risk:** although the LLM owns no facts, its tone can leak unauthored signals (e.g. sounding more desperate than the threshold implies). Guardrails in the dialogue prompt mitigate but do not eliminate this.
