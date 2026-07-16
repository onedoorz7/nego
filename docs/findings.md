# Findings & Next Recommendation (Phase 5)

Written at the end of the first build. Companion to `docs/product-spec.md` (what we planned) and `docs/decision-log.md` (what we decided along the way).

## What was built

The full founder success checklist works end to end (verified by automated E2E against a production build, plus 45 unit tests):

1. ✅ Open the app locally (`npm run dev`, no API key required)
2. ✅ Read a short lesson and pass a server-graded quiz
3. ✅ Prepare for a scenario (private brief + 7-field prep form)
4. ✅ Negotiate with an AI opponent (deterministic policy + LLM/mock dialogue)
5. ✅ Send structured offers (validated, snapped to field grids)
6. ✅ Reach an agreement or walk away (plus AI walk-away and turn-limit endings)
7. ✅ Receive a debrief (deterministic analysis + labeled coaching + role reveal)
8. ✅ See transparent scoring (six categories, each labeled objective/rule-based)
9. ✅ Replay with a new seeded variation
10. ✅ Modify scenarios/lessons as JSON and test again (admin inspector + content tests)

Also: progression (XP/unlocks/skills), analytics event table + derived metrics, JSON/CSV export, full model-call logging.

## What remains weak

- **Reveal gating is keyword-based.** The single highest-impact upgrade: an LLM classifier that labels the player's question against the scenario's topic list, with the deterministic gate and score untouched. Keep the keyword matcher as fallback.
- **Paraphrased leaks are undetectable** by the scanner (verbatim fragments only). Risk is bounded by prompt design (the model only ever *sees* facts it may share), but an eval harness would quantify it.
- **Mock dialogue is stilted.** Fine for testing; not for showing users.
- **Concession/process scores are coarse heuristics.** They behave sensibly in tests but haven't been calibrated against real judgments.
- **No pressure on message quality.** The player can type anything; only questions/topics matter mechanically. Tone does not yet affect the relationship beyond offer-driven frustration.
- **Single-issue prep fields.** Prep asks for numbers only on the primary field; multi-issue plans (e.g. "I'll trade support for price") aren't captured or scored.

## Assumptions not yet tested

- That the loop is *fun* and people replay voluntarily (the core hypothesis — needs humans).
- That scores feel credible rather than arbitrary to users.
- That difficulty 1 → 3 is actually a smooth ramp.
- That hidden-info discovery teaches question-asking (transfer, not just in-game behavior).

## Known AI reliability issues

- Live-call failures degrade to templates (never breaks a session) — rate visible in `/api/admin/metrics` (`ai_fallbacks`, `model_call_failures`).
- Guardrail scanner has triggered zero times in testing so far; sample size is tiny. Review `model_calls` where `ok = 0` after any real playtesting.

## Recommended user-test protocol (next)

1. Founder self-play: 10+ camera runs across seeds; tune `concession_rate`/`opening_demand` until the haggle feels right; repeat per scenario.
2. 3–5 friends, think-aloud, no help: watch where they stall (prep form length? offer panel discoverability? debrief comprehension?).
3. Metrics to review per tester: completion rate, replay rate, debrief dwell (proxy: `debrief_viewed` + time between events), agreement rate vs. quality of deals (player_utility distribution), questions-before-first-offer (does it rise across sessions? that's the learning signal).

## What to build next (recommendation)

1. **LLM-classified question/reveal matching** (deterministic gate kept) — biggest realism win per unit effort.
2. **A "daily seed" mode** — same seed for everyone, shareable score; cheap engagement experiment that exploits the variation engine.
3. **Session history & replay viewer** (read-only transcript walkthrough with the hidden state revealed turn by turn) — the Chess.com "analysis board" moment; most of the data already exists.
4. **A no-ZOPA scenario variant** (flag in `variation`) so walking away is sometimes the *correct* answer — closes the biggest pedagogical gap (research doc flagged this).
5. **Then** Phase 4 hardening (auth, limits, deploy) only once 1–3 show retention signal.

## On asynchronous multiplayer

Do not build yet. The architecture is ready (two full roles per scenario file, event-log sessions, engine-side evaluation), but multiplayer only pays off after single-player retention is proven. Prototype first with founder-vs-friend manual matches using the existing scenario briefs over chat. Full design: `docs/multiplayer-future.md`.
