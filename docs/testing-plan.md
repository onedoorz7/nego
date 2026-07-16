# nego — Testing Plan

Strategy: the deterministic core (utilities, policy, evaluation, content) gets dense **vitest unit coverage** — it's pure logic and cheap to test exhaustively. The LLM layer is treated as untrusted I/O: tested for containment and fallback, never for prose quality. One integration loop with the mock provider and fixed seeds ties it together. Manual testing = the founder's 10-point checklist. Everything AI-flaky gets logged and reviewed.

---

## 1. Unit tests (vitest)

### Utility model (`src/lib/` utility engine)
- Weighted-sum utility for number fields: `(value − worst)/(best − worst)` clamped to 0..1, × normalized weight × 100.
- Select fields map through `option_values`; missing option → error, not silent 0.
- Weights normalize correctly when they don't sum to 1.
- Direction handling: buyer (best 380 < worst 550) and seller (best 550 > worst 380) both score correctly on the same offer.
- Boundary values: at `best` → component 1; at `worst` → 0; outside the range → clamped.

### Reservation thresholds & opponent policy invariants
Property-style tests across seeds and turn sequences:
- **Never accepts below reservation:** for any offer with utility < effective reservation, intent is never `accept`.
- **Monotone decay:** acceptance threshold starts at target, is non-increasing turn over turn (absent events), and **never drops below reservation**.
- **Event deltas:** a fired event's `threshold_delta` shifts the threshold by exactly that amount, cumulatively (`event_threshold_delta`); floor at reservation still holds; each event fires once, at its `turn`.
- **Walk-away rules:** frustration accrues only per the rules (e.g. repeated sub-reservation offers); `warns_before_walking: true` guarantees a `warn_walk` before `walk_away`; turn limit → `turn_limit` outcome.
- **Counter-offers:** any generated counter is field-valid, in range/step, and has AI utility ≥ current threshold.
- Personality knobs respected: `opening_demand` positions the first offer; `patience` delays it; higher `concession_rate` reaches reservation-adjacent thresholds sooner.

### Offer validation (offer engine)
- Rejects: missing fields, extra/unknown fields, out-of-range numbers, values off the `step` grid, wrong types (string in number field), select values not in `options`.
- Accepts exactly the schema-valid shape; validation errors are structured (per field), not thrown strings.

### Outcomes
- **Mutual agreement:** accepting the standing offer freezes it as `final_offer`, sets both utilities, status `agreement`; no further turns accepted.
- **Walk-away:** player walk → `player_walked`, AI walk → `ai_walked`; outcome utilities null-or-BATNA per design; `walk_was_reasonable` true iff best available offer was below player reservation.
- Post-terminal actions rejected (no offers after agreement/walk).

### Evaluation engine
- **Joint value & max-value grid:** enumerate the full offer grid (all number steps × select options) to compute `max_joint_utility`; assert the evaluator matches brute force on small scenarios.
- **Pareto detection:** when a feasible offer exists that is ≥ for both sides and > for one vs. the reached deal, `pareto_improvement` returns one; when the deal is pareto-efficient, it's `null`.
- `zopa_existed`, `player_vs_reservation/target/batna` arithmetic; score items all 0–100 with non-empty explanations; XP deterministic for a given result.

### Private-info separation (leak prevention — highest-stakes tests)
Assert, on serialized API responses for the player:
- `ai_role.private_brief` never appears.
- Unrevealed `hidden_info` facts never appear (revealed ones only after their reveal turn, ids tracked in `revealed_info`).
- AI `reservation_utility`, `target_utility`, resolved variation params, and `acceptance_threshold` never appear.
- The LLM dialogue prompt contains only `allowed_reveals` facts — test the prompt builder directly.

### Malformed-AI-response handling
Mock provider returns: invalid JSON, schema-violating payloads, responses embedding numbers/offers that contradict the `PolicyDecision`, responses leaking a hidden fact not in `allowed_reveals`. Assert the pipeline: **validate → one retry → template fallback**, decision values always from the engine (LLM text never alters offer, intent, or numbers), `generated_by: "template"` set on fallback, incident logged.

### Content validation
For every file in `content/scenarios/` and `content/lessons/` plus `content/path.json`:
- Parses against its Zod schema (`ScenarioSchema` / `LessonSchema` / `PathSchema`).
- **ZOPA exists** for default params and for the extreme corners of `variation` ranges (some feasible offer ≥ both reservations) — unless the scenario explicitly opts out.
- `reservation_utility < target_utility` for both roles; BATNA utility consistent with reservation.
- Preferences reference only real `offer_fields` keys; select `option_values` cover all options; `primary_field` exists; event `turn` ≤ max turn limit; quiz `answer_index` in range; `path.json` ids resolve to lesson files; lesson `scenario_id`s resolve to scenario files.

## 2. Integration tests

**Full session loop, mock provider, fixed seeds.** For each scenario × a small seed set:
1. Create session → resolved params within `variation` ranges; same seed ⇒ identical params (replay determinism), different seeds ⇒ differing params.
2. Submit prep → status `active`.
3. Scripted playthroughs: (a) converge to agreement — transcript, `offer_history`, `standing_offer`, outcome, and evaluation all consistent; (b) stonewall until AI walks; (c) player walks; (d) run out the turn limit; (e) trigger a hidden-info reveal via a topic keyword and see it in `revealed` + discovery score.
4. Event fires at its turn exactly once; threshold shift observable in subsequent policy decisions.
5. Evaluation + coaching produced for every terminal status; API responses pass the leak assertions throughout.

## 3. Manual founder protocol

Run the **10-point checklist** from `docs/product-spec.md` (Definition of success) end-to-end before calling any phase done — open locally, lesson+quiz, prep, negotiate, structured offers, agree *and* (separate run) walk, useful debrief, transparent scoring, replay-with-different-game, edit-JSON-and-see-it. Repeat once with the mock provider and once with a real key when available.

## 4. AI-reliability logging

Log (SQLite analytics events) every: **leak detection** (LLM output contained forbidden content and was blocked), **validation failure** (schema-invalid LLM response), **retry**, **template fallback**. Weekly founder review: rates per provider/model, which scenarios trigger them, whether fallback text was noticed in playtests. Rising leak/fallback rates are a launch blocker for P4 — this log is the evidence assumption A4 ("opponent feels real") and the AI-reliability risk mitigation stand on.

---

**Not tested (deliberately):** LLM prose quality, tone adherence to `style_prompt`, coaching helpfulness — these are judged in playtests (assumptions A2, A4), not asserted in CI.
