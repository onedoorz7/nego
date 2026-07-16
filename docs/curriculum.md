# nego — Curriculum Map

Ten lessons in `content/path.json` order. Each lesson = summary + example + common mistake + quiz (1–4 items) + optional attached practice scenario. Concepts also resurface in every debrief via scores and rule-based observations, so lessons without their own scenario still get practiced.

**Debrief score keys referenced below:** `personal_outcome`, `joint_value`, `discovery`, `concession_discipline`, `preparation`, `process`.

---

## Lessons

### 01 · Interests vs. Positions
- **Objective:** Distinguish what someone asks for (position) from why they want it (interest).
- **Key idea:** A position is a stated demand ("$520, firm"); an interest is the need behind it (cash by Friday, camera going to a good home). Positions collide; interests often don't — and deals hide in the gap. The first skill in every negotiation is translating demands into underlying needs, on both sides, including your own.
- **Practice:** Quiz; reinforced in every debrief (discovery observations flag when the player never probed for interests).
- **Measured by:** `discovery`, `joint_value`.

### 02 · BATNA: Your Best Alternative
- **Objective:** Identify, improve, and use your best alternative as the source of negotiating power.
- **Key idea:** Your BATNA is what you'll *actually do* if no deal happens — not a wish. It sets the floor for any acceptable deal and lets you negotiate calmly because walking away is real. Estimating the *other side's* BATNA (Sam needs cash by Friday) is equally powerful: their pressure is your leverage.
- **Practice:** **`used-camera-001`** — the $475 cross-town listing is the player's BATNA; discovering Sam's weak BATNA is the scenario's core reward.
- **Measured by:** `preparation` (BATNA field filled and consistent), `personal_outcome` (utility vs. BATNA).

### 03 · Reservation Point
- **Objective:** Derive a concrete walk-away number from your BATNA — and never cross it.
- **Key idea:** The reservation point is your BATNA converted into deal terms: the exact worst deal still better than no deal. Set it before talking, in writing, or the room will set it for you. Crossing it isn't "closing the deal", it's losing while feeling like a winner.
- **Practice:** Quiz; reinforced in debriefs (accepting below reservation is flagged; prep reservation vs. actual acceptance compared).
- **Measured by:** `personal_outcome` (utility vs. reservation), `preparation`, `concession_discipline`.

### 04 · ZOPA
- **Objective:** Reason about the zone of possible agreement — where both reservation points overlap.
- **Key idea:** A deal is only possible in the range between your reservation point and theirs. You never see the ZOPA directly; you infer it from their behavior and what discovery reveals. If no ZOPA exists, the winning move is a graceful exit, not persistence — effort can't manufacture overlap.
- **Practice:** Quiz; reinforced in debriefs (`zopa_existed` analysis; walk-away reasonableness).
- **Measured by:** `personal_outcome`, `process` (walked when no ZOPA / persisted when one existed).

### 05 · Targets and Openings
- **Objective:** Set an ambitious-but-realistic target and plan an opening consistent with it.
- **Key idea:** Negotiators who aim higher get more — the target, not the reservation point, should drive your moves. Your opening offer should sit beyond your target (leaving trading room) but inside plausibility. Planning both numbers before the first message is what separates strategy from improvisation.
- **Practice:** Quiz; reinforced in debriefs (planned opening/target from prep vs. actual first offer on `primary_field`).
- **Measured by:** `preparation` (plan vs. play gap), `personal_outcome` (utility vs. target).

### 06 · Anchoring
- **Objective:** Use first offers to pull the negotiation toward your target; defuse the other side's anchor.
- **Key idea:** First numbers exert gravity — the final deal correlates strongly with whoever anchors first, even when the anchor is arbitrary. Anchor first when you're informed; when anchored against, re-anchor with your own number and independent reasoning instead of counter-offering off their figure.
- **Practice:** Quiz; reinforced in debriefs (who made the first offer, how far it sat from target, counter-relative-to-anchor observations).
- **Measured by:** `process` (opened first / re-anchored), `personal_outcome`.

### 07 · Concessions
- **Objective:** Concede deliberately — decreasing steps, always for something in return.
- **Key idea:** How you concede tells the other side how much further you'll go. Shrinking concessions signal a genuine limit; big or unreciprocated ones invite more pressure. Never move twice in a row without getting movement back, and label your concessions so they earn credit.
- **Practice:** Quiz; reinforced in debriefs — this is the `concession_discipline` score's home turf.
- **Measured by:** `concession_discipline` (step sizes, direction, reciprocity), `personal_outcome`.

### 08 · Diagnostic Questions
- **Objective:** Ask questions that reveal constraints, deadlines, and preferences — the hidden-info mechanic, taught explicitly.
- **Key idea:** Most negotiators talk when they should ask. Open, diagnostic questions ("why are you selling?", "what happens if it doesn't sell this week?") surface the other side's interests, BATNA, and flexibility — information that is worth more than any bargaining tactic. In nego, `hidden_info` only unlocks when you ask about the right topics.
- **Practice:** Quiz; reinforced everywhere — every scenario's `discovery` score counts revealed vs. missed hidden facts, weighted by importance.
- **Measured by:** `discovery` (primary), `joint_value`.

### 09 · Multi-Issue Trade-offs
- **Objective:** Trade across issues you value differently to grow the pie instead of splitting it.
- **Key idea:** When several issues are on the table (price, timeline, scope, revisions), the sides rarely weight them the same way. Giving cheaply on what they value most and holding what you value most creates joint value — deals where both do better than a compromise down the middle. Package offers; never negotiate issue-by-issue.
- **Practice:** **`freelance-website-001`** — multi-issue, integrative; the pareto-improvement analysis shows when a better package existed.
- **Measured by:** `joint_value` (vs. max joint utility, pareto detection), `personal_outcome`.

### 10 · Walking Away
- **Objective:** Recognize when no deal beats the available deal — and exit well.
- **Key idea:** Walking away is a move, not a failure. If the best achievable offer sits below your reservation point, leaving *is* the win — and leaving gracefully preserves the relationship and the option to return. The hardest version is when you've invested time and emotion: sunk cost is the closer's best friend.
- **Practice:** **`salary-offer-001`** — multi-issue plus relationship stakes; some seeds make walking the correct outcome.
- **Measured by:** `personal_outcome` + `walk_was_reasonable` analysis, `process`.

---

## Ramp rationale (easy → advanced)

- **Lessons 1–4** build the *analytical frame* (interests, BATNA, reservation, ZOPA) — needed before any move makes sense. Scenario: difficulty-1 camera (one main issue + extras), so cognitive load stays on the concepts.
- **Lessons 5–7** add the *distributive moves* (targets, anchors, concessions) — still practiced on familiar single-issue ground via debrief feedback.
- **Lessons 8–9** unlock the *integrative game* (questions → hidden info → trade-offs), matching difficulty-2 freelance-website where the pie can grow.
- **Lesson 10** caps with judgment under pressure in difficulty-3 salary-offer, where relationship and multiple issues interact and walking can be right.

One new idea per lesson; each scenario exercises everything unlocked so far. Same principle as Duolingo: never introduce a mechanic the player hasn't been taught, never teach a concept the player can't immediately use.

## Unlock rules

- Lessons unlock strictly in `path.json` order.
- **Pass the lesson quiz → next lesson unlocks.**
- If a lesson has a `scenario_id`, one scenario attempt is **encouraged** (prompted, XP-rewarded) before moving on, and required for the path step to show as fully complete — but quiz pass alone unblocks progress, so a player is never hard-stuck on a game.
- Replays are always available for any unlocked scenario (seeded variation makes them fresh).

## Future module backlog (post-MVP, rough priority)

1. **Objective criteria** — legitimacy, market standards, "fair" anchors.
2. **Contingent agreements** — betting on disagreements ("if the shutter count is wrong, refund $50").
3. **Trust repair** — recovering after a misstep or hardball moment.
4. **Power** — negotiating up/down a power gradient; borrowing power.
5. **Deadlines & time pressure** — using and defusing clocks.
6. **Ethics** — lines you don't cross; handling the other side's dirty tactics.
7. **Multiparty** — coalitions, sequencing, negotiating with more than one counterpart.

## How to edit / add lessons

- **Files:** one lesson per JSON file in `content/lessons/` (e.g. `content/lessons/02-batna.json`); scenarios live in `content/scenarios/`; the ordered path is `content/path.json`.
- **Schema:** `LessonSchema` in `src/lib/content/schema.ts`. Required fields: `id`, `order`, `concept` (machine key), `title`, `summary` (markdown, <300 words), `example` (markdown), `common_mistake`, `prep_question`, `quiz` (1–4 items: `question`, `choices` [2–5], `answer_index`, `explanation`), `scenario_id` (or `null`). Optional: `emoji`.
- **To add a lesson:** create the JSON file, add its `id` to `content/path.json` in position, restart the dev server. Zod validation fails loudly on malformed content — fix what it names.
- **To attach a scenario:** set `scenario_id` to an existing scenario file's `id` (see `ScenarioSchema` for scenario authoring). Use `null` for quiz-only lessons.
- No code changes, migrations, or redeploys for content edits — that property is a product requirement (assumption A7 in the product spec).
