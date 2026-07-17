# nego 🤝

**A negotiation game.** Tap play and you're at the table: the camera's listed at $520, and every dollar you knock off is a point. The seller has secrets, moods, and a real bottom line — ask the right questions and the round opens up. Close a deal to bank points and unlock the next round; lose the round and the game shows you what was possible. The theory (10 short lessons) is there for the curious, after the playing.

Think *a game people replay to beat their score* that quietly happens to be *Duolingo for negotiation* × *Chess.com game review*. Founder-experimentation stage.

## What's in this build (current scope)

- **Game-first flow**: home screen = rounds + PLAY. No briefing walls, no prep forms, no lesson gates — one mission line and you're negotiating. Hints blend into the game itself.
- **Arcade scoring**: concrete points per round ("every $ you save is a point", bonuses for extras/terms, overpaying eats your bonuses, no deal = 0). Best score per round, total across rounds, best-possible teased after each game.
- **3 rounds**, easy → advanced (each unlocked by closing a deal in the previous):
  1. 📷 **The Used Camera** — mostly single-issue price + one extras variable.
  2. 🧑‍💻 **The Studio Website** — multi-issue freelance project, integrative trades.
  3. 💼 **The Written Offer** — salary negotiation, relationship dynamics.
- **10 optional lessons** (interests vs positions → walking away) in the Learn tab — reference material, never a gate.
- **A deterministic game engine.** The LLM only writes dialogue; it never decides offers, facts, or scores:
  - Every scenario has *phases of play* (explore → bargain → close), *hidden information* that only surfaces when you ask about the right topics, *scripted surprise events* mid-game, and *seeded variation* (bottom lines, aggressiveness, and turn limits are sampled per session — every replay is a different game, and any game can be reproduced from its seed).
  - The AI opponent's accept/counter/walk decisions come from a transparent policy: an acceptance threshold decaying from its target toward (never below) its reservation, counters computed on the exact Pareto frontier of the offer space (so it trades what's cheap for it and valuable for you), frustration and walk-away rules.
- **Deterministic evaluation** — six scores (personal outcome, joint value, information discovery, concession discipline, preparation, questions & process), each labeled *objective* or *rule-based*, plus rule-based observations. LLM coaching is separate and clearly labeled subjective.
- **Post-game result screen** — points breakdown, secrets found/missed (with a reveal toggle), the opponent's true floor after a lost round, one tip, replay hook; the full six-score analysis + AI coaching one tap deeper.
- **Progression** — points, round unlocks, personal bests, per-skill rolling averages.
- **Founder tools** (`/admin`) — session transcripts with hidden parameters, raw model calls, scenario inspector (computed ZOPA/frontier for authored numbers), metrics, JSON/CSV export, reset.
- **Analytics** — local event table (no external tracking).

Not in this build (deliberately): auth/accounts, deployment hardening, multiplayer (designed in `docs/multiplayer-future.md`), badges/leagues.

## Install & run

```bash
npm install
npm run dev        # http://localhost:3000
```

Works fully **without any API key** — a deterministic mock provider templates the AI's dialogue so the whole game loop is playable offline (tone is basic; decisions are identical).

For natural dialogue and AI coaching:

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
```

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Enables live dialogue + coaching via the Claude API |
| `NEGO_MODEL` | `claude-opus-4-8` | Model used for dialogue/coaching |
| `NEGO_PROVIDER` | `auto` | `auto` \| `anthropic` \| `mock` |
| `NEGO_UNLOCK_ALL` | — | `1` unlocks all lessons/scenarios (founder testing) |
| `NEGO_DATA_DIR` | `./data` | SQLite location (`nego.db`) |

### Tests

```bash
npm test           # vitest: engines, policy invariants, privacy separation, content validation
npm run typecheck
```

## How to add or edit content

Content is plain JSON — no code changes, no rebuild (refresh the page in dev).

- **Lessons:** `content/lessons/*.json` — schema in `src/lib/content/schema.ts` (`LessonSchema`); add the id to `content/path.json` to put it on the path. See `docs/curriculum.md`.
- **Scenarios:** `content/scenarios/*.json` — schema `ScenarioSchema`. Full authoring guide with worked arithmetic: `docs/scenario-design.md`. After editing, open `/api/admin/scenarios/<id>` to verify ZOPA exists and the frontier looks sane, and run `npm test` (content tests validate every file).
- **Hidden values / utility weights / AI personality:** all live in the scenario JSON (`preferences`, `reservation_utility`, `personality`, `hidden_info`, `events`, `variation`).

## How scoring works (short version)

Each role's utility for an offer is a weighted sum of per-field normalized values on a 0–100 scale. Reservation/target/BATNA are authored on the same scale. After each game the evaluation engine computes outcome analysis (deal utilities, joint vs max-possible value via exact offer-space analysis, ZOPA existence, pareto-better packages, walk-away reasonableness) and six category scores. Formulas: `docs/scoring-framework.md`. The LLM never produces a number.

## Repo map

```
content/            lessons, scenarios, learning path (editable JSON)
docs/               product spec, research foundation, curriculum, scenario
                    authoring, scoring, testing plan, multiplayer design,
                    decision log, findings
src/lib/content/    Zod schemas + loader
src/lib/engine/     utility model, offer validation, offer-space analysis (exact DP),
                    opponent policy, session state machine, evaluation, variation
src/lib/llm/        provider abstraction: Anthropic (validated + guarded) & mock
src/lib/coaching/   debrief generation (LLM or template)
src/lib/db/         SQLite (node:sqlite) — sessions, events, model calls, progress
src/app/            Next.js App Router pages + API routes
tests/              vitest suites (45 tests)
```

## Current limitations (honest list)

- **Reveal matching is keyword-based.** Asking about a hidden topic with unusual phrasing may not unlock it. (Logged as a candidate for an LLM-classified-but-deterministically-scored upgrade.)
- **Leak detection is verbatim-only.** A paraphrased leak by the dialogue model would pass the scanner (it is still constrained by prompt + never told what it can't reveal beyond its lists).
- **The mock provider's prose is stilted** — decisions are identical to live play, but tone is template-quality.
- **Question-quality scoring is shallow** (question-mark/keyword heuristics), labeled rule-based accordingly.
- **Single local user, no auth** — do not deploy publicly as-is (`/admin` is open by design).
- **Scoring weights are product assumptions**, not validated instruments — see the validity section of `docs/scoring-framework.md`.

See `docs/findings.md` for what was built, what's weak, and the recommended next steps.
