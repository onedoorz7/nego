# Scenario Design Guide

How to author a nego scenario. Schemas live in `src/lib/content/schema.ts`; the worked example throughout is `content/scenarios/used-camera-001.json`. Scoring math is in `docs/scoring-framework.md`.

**The rule that shapes everything:** a scenario is a *deterministic game definition*. The LLM never owns facts, constraints, offers, thresholds, or scores — it only verbalizes decisions the opponent-policy engine already made. Every behavior you want must therefore be expressed in numbers and structured data, not in prose hoping the LLM plays along. Prose fields (`style_prompt`, briefs, `talking_points`) shape *tone and knowledge*, never *decisions*.

---

## 1. Field-by-field walkthrough (`ScenarioSchema`)

### Top level

| Field | Used-camera value | Notes |
|---|---|---|
| `id` | `"used-camera-001"` | Stable slug; filename matches. Never reuse — progress keys off it. |
| `title`, `emoji`, `tagline` | "The Used Camera", 📷, one-line pitch | Card copy. Tagline should hint at the hidden mechanic ("what you learn about the seller changes everything"). |
| `difficulty` | 1 | 1–5. Feeds the XP multiplier; also your promise about how forgiving the numbers are. |
| `concepts` | batna, reservation_point, anchoring, concessions, walking_away | Machine keys. Drive skill-EWMA updates and lesson linkage — only list concepts the scenario genuinely exercises. |
| `public_context` | The marketplace listing + meeting setup | Markdown both sides know. The **listing price lives here** ($520) — it's a public anchor, not a preference. |
| `player_role` / `ai_role` | see §2 | |
| `offer_fields` | price (number), extras (select) | See §3. |
| `primary_field` | `"price"` | The headline field; plan-vs-play comparisons key on it (§9). |
| `turn_limit` | 12 | 4–30. A turn = one player action + the AI's response. Overridable by `variation`. |
| `preparation` | 7 fields | See §9. |
| `events` | `another_buyer` at turn 6 | See §7. |
| `variation` | 3 ranges | See §8. |

### 2. Roles

Both roles share `RoleBaseSchema`:

- **`name`, `persona`** — display identity ("Buyer"; "Seller (Sam)").
- **`private_brief`** — Markdown shown ONLY to that side. The player's brief is their briefing screen; the AI's brief goes into the dialogue prompt. The brief must **agree with the numbers** (§4) — this is the most common authoring bug.
- **`preferences`** — the utility model (§3).
- **`batna`** — `description` + `utility` (0–100). The all-in value of walking away.
- **`reservation_utility`** — walk-away line; the AI's threshold floor, the player's scoring floor.
- **`target_utility`** — ambitious-but-realistic goal; the AI's threshold start, the player's scoring ceiling.

`AiRoleSchema` adds `personality` (§5), `hidden_info` (§6), and `talking_points` — freely shareable color the AI may volunteer when asked ("bought it new three years ago"). Use talking_points for flavor that costs nothing to reveal; use hidden_info for facts with strategic value.

### 3. Offer fields and preferences

**Number field:** `key, label, unit, min, max, step`. The `min/max/step` define the *offer space* players and AI can propose over ($300–600, step 5 → 61 prices). Preference `best/worst` define the *utility anchors* inside it (buyer: best 380, worst 550). Keep `min ≤ both anchors ≤ max`; values beyond anchors clamp flat, which is fine — it lets lowballs exist without negative utility.

**Select field:** `options` (≥ 2). Each role's preference needs `option_values` mapping **every** option value to 0..1.

Utility (see scoring doc §1 for the worked arithmetic):

```
utility = Σ_f normalized_weight_f × value_f × 100
```

Weights normalize to sum 1 at load. The camera's authored weights (0.85/0.15 and 0.9/0.1) already sum to 1 — but a three-field scenario can use raw weights like 5/2/1.

**Design for logrolling.** Value creation exists only when the sides weight fields differently. Camera: extras are worth 15 points to the buyer but only 10 to Sam, and Sam's option_values *decline* (none 1 → full_kit 0.15) while the buyer's *rise* (0 → 1). That asymmetry is what makes "$440 + battery & bag" better for both than "$430 camera-only" — and the counter-offer generator exploits it automatically.

### 4. Authoring coherent reservation / target / BATNA — the arithmetic

Work **from real-world numbers to utilities**, then check the round trip. Method:

1. Write the brief's concrete facts first (budget cap $460, market $430–490, fallback listing $475).
2. Convert the walk-away deal to utility. Buyer camera-only: `U = 0.85 × (550 − p)/170 × 100 = 0.5 × (550 − p)`. At the $460 cap → **U = 45**. Set `reservation_utility: 45`. ✔ brief and number agree.
3. Convert the ambitious-but-realistic goal. A great outcome per the brief is ~$410 camera-only (U = 70) or $428 with battery & bag (0.5×122 + 9 = 70). Set `target_utility: 70`.
4. Set `batna.utility` as an all-in judgment near reservation. Face value of the $475 fallback is 0.5 × 75 = 37.5; the authored 45 folds in the option value of haggling that seller down too, net of the 40-minute drive and condition risk. Convention: `reservation_utility ≈ batna.utility` (never far below it — accepting deals worse than your BATNA would be irrational by construction).
5. Do the same for the AI. Sam: reservation 22 ⇔ camera-only **$402.70** (`p = 380 + 1.889 × (U − 10)`), target 68 ⇔ **$489.60**.
6. **Check the ZOPA exists** (unless no-ZOPA is the lesson): buyer accepts camera-only ≤ $460; Sam ≥ ~$403. Overlap $405–460 ✔. With battery & bag: $412–478 ✔ and wider.
7. Check both targets are *inside the offer space* and mutually infeasible (buyer target $410 vs Sam target $490 — good: they must negotiate).

### 5. Personality → policy

The `style_prompt` shapes wording only. Four numbers govern behavior:

- **`opening_demand`** (0..1): the AI's first offer targets AI-utility ≈ `opening_demand × 100` (its best corner is 100). Camera: 0.85 → level 85 → camera-only `380 + 1.889 × 75 ≈ $522` — deliberately matching the $520 public listing. **Tune opening_demand to your public anchor.**
- **`concession_rate`** (0..1): per player-turn threshold decay = `concession_rate × (target − reservation)`. Camera: 0.12 × (68 − 22) = **5.52 points/turn**. Threshold trajectory (with the turn-6 event +4):

  | turn | 0 | 2 | 4 | 6 | 8 | 10 |
  |---|---|---|---|---|---|---|
  | threshold | 68.0 | 57.0 | 45.9 | 38.9 | 27.8 | 22.0 (floor) |
  | ≈ min camera-only price | $490 | $469 | $448 | $435 | $414 | $403 |

  The threshold **never drops below reservation**. Rough sizing rule: the AI reaches its floor after ~`1/concession_rate` player turns — keep that comfortably inside `turn_limit` if you want late-game deals at the floor to be reachable (1/0.12 ≈ 8.3 turns vs limit 10–12 ✔).
- **`patience`** (int ≥ 0): player turns the AI waits before making the first offer itself if the player hasn't. Camera: 3 — Sam tolerates three turns of chat, then names $520-ish. Set `patience > turn_limit` for an AI that never opens (forces the player to anchor).
- **`warns_before_walking`**: if true, one `warn_walk` intent precedes `walk_away`. Repeated below-reservation lowballs raise `frustration` (see `AiInternalState`); enough frustration triggers the walk path. The camera's `lowball_last_week` hidden info themes this narratively.

Counter-offer selection (all phases): scan the discretized offer grid for candidates near the current desired AI-utility level (threshold, or the opening level for the first offer), pick the candidate that **maximizes player utility** — automatic integrative behavior, no LLM involved.

### 6. `hidden_info` and `reveal_topics`

Each item: `id`, `fact` (phrased for the AI to weave into dialogue, second person "You need the money by Friday…"), `reveal_topics`, `importance` (1–3, weights the discovery score).

**Matching is case-insensitive substring over the player's message; keep entries lowercase.** A fact unlocks when any topic string appears in a player message; the policy then lists it in `allowed_reveals` and the dialogue layer may weave it in.

Be **generous with synonyms and use stems**: camera's `needs_cash_friday` lists `"why", "selling", "upgrad", "hurry", "timeline", "deadline", "soon", "quick", "when do you", "rush", "new camera", "new lens"` — `"upgrad"` matches *upgrade/upgrading/upgraded*; `"accessor"` (in `spare_extras`) matches *accessory/accessories*. Ten-plus topics per fact is normal. Watch for over-broad strings: a topic like `"why"` will also fire on "why is the price so high?" — acceptable here (asking *why* anything is probing), but audit each short string against likely bargaining chatter.

Set `importance` by strategic value: the Friday deadline (changes the whole game) is 3; shutter count and spare extras (useful) are 2; the prior lowball (color/warning) is 1.

### 7. Events and `threshold_delta`

Scripted surprises: fire at a fixed player-turn, show `player_note` as a system message, inject `ai_note` into the dialogue context, and shift the acceptance threshold by `threshold_delta` **from that turn on** (positive = tougher, negative = more eager; still floored at reservation).

Camera: `another_buyer` at turn 6, +4 — a mid-game pressure bump that partially cancels one turn of decay (5.52), teaching players that stalling isn't free. Keep deltas small relative to `target − reservation` (here 4 vs 46 ≈ 9%); a delta that pushes the threshold back above early-game levels reads as arbitrary.

### 8. Variation — "infinite games"

`variation` ranges are sampled **once per session with a seeded RNG** (seed stored in `SessionState`, resolved into `ResolvedParams`), so the same file yields many distinct games and replays can't be solved by memorizing numbers. Samplable: `ai_reservation_utility`, `ai_target_utility`, `opening_demand`, `turn_limit` (integer). Unlisted params use their authored values.

Camera: reservation 18–28 (floor price ~$395–$414), opening_demand 0.78–0.92 (opening ~$508–$535), turn_limit 10–12. Keep ranges tight enough that the brief stays true for every sample — check the **worst-case corners**: at sampled reservation 28 (⇔ camera-only floor 380 + 1.889 × 18 ≈ $414) the ZOPA is still $415–460 camera-only ✔; never let a sampled corner kill the ZOPA (unless that's the lesson, in which case say so in the debrief design).

### 9. Preparation form and `refers_to`

`preparation` fields render the prep screen; answers are stored in `SessionState.prep` and scored (scoring doc §4.5). Standard ids: `goal`, `batna`, `reservation`, `target`, `opening`, `questions`, `avoid_reveal` — keep these ids when applicable, the evaluator knows them.

For `kind: "number"` fields, set `refers_to` to an offer-field key (usually `primary_field`). That linkage powers plan-vs-play checks: the camera's `reservation` prep field (`refers_to: "price"`) is compared against the utility-derived $460, and the `opening` field against the player's first actual offer price. A number field without `refers_to` can be collected but not checked.

### 10. Phases of play

The engine tracks `GamePhase` and the policy behaves differently in each:

- **`explore`** — before any offer exists. AI answers questions, weaves `allowed_reveals`, volunteers `talking_points`, and `nudge`s the player toward concreteness; after `patience` player turns it makes the `first_offer` itself. Discovery is cheapest here — the process score counts question-turns *before the first offer*.
- **`bargain`** — an offer is live. Each player turn: threshold decays, standing player offers are tested against it (accept / counter / reject), lowballs raise frustration and cool the mood (`warm → neutral → wary → annoyed`).
- **`close`** — last ~2 turns before `turn_limit`, or near-agreement (standing-offer utility within a few points of the threshold). Concessions run to the floor, the AI pushes accept-or-walk, and `warn_walk` fires here if it's going to.
- **`done`** — terminal.

Author with the phase clock in mind: `patience` bounds explore, `1/concession_rate` sizes bargain, and `turn_limit` minus ~2 is where close begins. Camera: 3 explore turns + ~7 decay turns + 2 close turns ≈ the 10–12 turn limit.

---

## 11. Checklist: authoring a new scenario

1. Pick 1–3 `concepts` the scenario should teach; write the `tagline` as the lesson's hook.
2. Design the offer space: one `primary_field` number field + 1–2 secondary fields with **asymmetric** preferences (logrolling fuel). Choose `min/max/step` so the grid stays small (≤ a few thousand cells).
3. Write both `private_brief`s with concrete real-world numbers first.
4. Set `preferences` (weights, best/worst, option_values — every option, both roles).
5. Derive `reservation_utility`, `target_utility`, `batna.utility` from the briefs' numbers (§4 arithmetic) — show your work in a comment or PR description.
6. Verify the ZOPA and compute the max-joint offer by hand; make sure the intended "great outcome" is findable.
7. Tune `personality`: opening_demand to match your public anchor; concession_rate so `1/rate` fits the turn budget; patience; warns_before_walking.
8. Write 3–5 `hidden_info` items with generous lowercase stem-based `reveal_topics` and deliberate `importance` spread; move free color into `talking_points`.
9. Add 0–2 `events` with small `threshold_delta`s at mid-game turns.
10. Set `variation` ranges and check every corner of the sampled box keeps the brief true and the ZOPA alive.
11. Build the `preparation` form using the standard ids; wire `refers_to` on numeric fields.
12. Playtest: (a) speedrun straight to offers, (b) ask everything first, (c) lowball repeatedly, (d) stall to the turn limit. Check scores, mood, and walk behavior all read fairly.

## 12. Common pitfalls

- **No-ZOPA reservations** — reservations that don't overlap anywhere on the grid make every session end in frustration. Check the overlap arithmetic (§4.6), including variation corners.
- **Weights contradicting the brief** — a brief that says "delivery time matters more than price" over preferences weighted 0.9 price makes the coach and the scores gaslight the player. Recompute the brief's claims from the utility model.
- **`reveal_topics` too narrow** — three exact phrases means players ask reasonable questions and hit nothing; discovery scores flatline. Use stems and 8–12 synonyms.
- **Missing `option_values` coverage** — every select option needs a value **for both roles**; a missing option has undefined utility and corrupts the grid analysis.
- **Anchors outside the offer space** — `best/worst` or a target-equivalent price outside `[min, max]` makes targets unreachable or clamps everything flat.
- **`opening_demand` vs public anchor mismatch** — an AI that opens far above its own public listing price breaks believability (compute the opening price like §5).
- **Decay/turn-limit mismatch** — `1/concession_rate` ≫ `turn_limit` means the AI's floor is unreachable and every game times out; ≪ means the AI caves comically fast.
- **Events that overwhelm decay** — a big positive `threshold_delta` late can make agreement impossible; keep |delta| under ~2 turns of decay.
- **`batna.utility` far from `reservation_utility`** — a reservation well below BATNA tells players to accept deals worse than walking.
- **Hiding decisive facts in `style_prompt`** — the LLM can't change thresholds; behavioral intent written only as prose silently does nothing.

## 13. Future mechanics ideas

- **Multi-session arcs** — chained scenarios sharing state (a supplier deal whose terms become the next scenario's constraints); teaches relationship vs. transaction framing.
- **Reputation carryover** — a per-counterpart reputation scalar (fed by mood/frustration history) that shifts future `opening_demand` and `concession_rate` against habitual lowballers.
- **Time-pressure mode** — real-clock decay or per-turn timers layered on the threshold schedule; teaches deadline effects and patience discipline.
- **Procedural generation** — sample whole scenarios (fields, weights, briefs templated from the numbers) instead of just `variation` ranges; the utility model already makes generated games scorable, the hard part is briefs that stay coherent — generate numbers first, render prose from them, never the reverse.
- **Multi-party / agent-mediated rounds** — two AI counterparties with separate thresholds; teaches coalition and comparison shopping.
- **Reverse-role replays** — play Sam's side of the same file (roles are structurally symmetric) to internalize the other side's constraints.
