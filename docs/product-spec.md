# nego — Product Spec

**One-liner:** Duolingo for negotiation — bite-sized lessons that unlock playable AI negotiation games, with Chess.com-style post-game review, so anyone can build a real-world skill through deliberate, repeatable play.

---

## Core hypothesis

People fail to learn negotiation not because the theory is hard, but because they never get **safe, repeatable practice with honest feedback**. If we pair short concept lessons with deterministic, replayable negotiation games and a transparent debrief, players will (a) complete the loop, (b) measurably improve across replays, and (c) come back voluntarily.

**The loop:**

```
LEARN (short lesson + quiz)
  → PREPARE (structured prep form: goal, BATNA, reservation, target, opening, questions)
    → PRACTICE (turn-based negotiation vs. deterministic AI opponent)
      → DEBRIEF (objective scores + rule-based observations + labeled LLM coaching)
        → REPLAY (seeded variation → same scenario, different game)
```

Every product decision should strengthen this loop; anything that doesn't is out of scope for MVP.

## Falsifiable product assumptions

1. **A1 — Loop completion:** ≥60% of test users who start a lesson complete one full loop (lesson → debrief) in a single sitting (<25 min).
2. **A2 — Debrief value:** ≥7/10 test users say the debrief told them something specific they'd do differently (not generic praise).
3. **A3 — Replay pull:** ≥40% of users who finish a scenario replay it at least once without being prompted.
4. **A4 — Deterministic opponent feels real:** ≤2/10 users describe the AI opponent as "random", "cheating", or "broken" (dialogue may be LLM, but offers must feel coherent).
5. **A5 — Scores feel fair:** ≥7/10 users, shown the score explanations, agree the scores match what happened in their game.
6. **A6 — Transfer signal (weak):** users self-report at least one intended real-world application after 3+ sessions.
7. **A7 — Content-as-JSON velocity:** the founder can create and ship a new scenario in <1 day with no code changes.

Each assumption has a threshold; missing it triggers a pivot conversation, not tweaking.

## MVP definition, phase by phase

### P1 — Foundation docs (this phase)
Product spec, curriculum map, testing plan. Content schema (`src/lib/content/schema.ts`) and shared runtime types (`src/lib/types.ts`) locked in. Exit: a stranger could read `/docs` and build the slice.

### P2 — Vertical slice: used-camera end-to-end
One lesson (`02-batna`) → prep form → full negotiation vs. Sam (`used-camera-001`) → debrief → replay with new seed. Includes: utility model, opponent policy, offer engine, evaluation engine, mock LLM provider (runs without API key), session persistence, XP. Exit: founder passes the 10-point checklist (below) locally.

### P3 — Expansion
Three scenarios (used-camera, freelance-website, salary-offer), all 10 lessons, learning path with unlocks, minimal admin view for content, analytics events in SQLite (`node:sqlite`), session/data export. Exit: full curriculum playable; funnel events queryable.

### P4 — Small-beta readiness (**not built yet — checklist only**)
Auth (lightweight), onboarding flow, error handling & empty states, privacy note, in-app feedback form, rate/usage limits, basic monitoring & LLM-reliability dashboards. Build only when P3 findings justify inviting outsiders.

### P5 — Findings & next recommendation
Run 5–10 user tests against A1–A7. Write up findings and a single recommendation: double down (more scenarios / ratings / async matches), fix the loop, or stop.

## Definition of success — founder's 10-point checklist

The MVP is "done" when the founder can, locally and without an API key:

1. Open the app locally (`npm run dev`) and reach the learning path.
2. Read a lesson and pass its quiz.
3. Fill in the preparation form (BATNA, reservation, target, opening, questions).
4. Negotiate with the AI in free text over multiple turns and get coherent responses.
5. Make structured offers via the offer form (validated fields, in-range values).
6. Reach a mutual agreement — or walk away — and have the session end correctly.
7. Get a debrief that is genuinely useful (specific, references actual moves).
8. See transparent scoring: every score has a visible, checkable explanation.
9. Replay the same scenario and get a noticeably different game (seeded variation).
10. Edit the scenario JSON, restart, and see the change in play — no code edits.

## Key risks & mitigations

| Risk | What could go wrong | Mitigation |
|---|---|---|
| **Product** | The loop is educational but not fun; nobody replays. | Ship the smallest slice first; test A1/A3 with real users before P3; game-design pillars (below) exist specifically to fight this. |
| **AI reliability** | LLM leaks hidden info / invents offers, prices, or facts. | Hard separation: deterministic engine decides everything; LLM verbalizes a `PolicyDecision` only. Validate LLM output, retry once, fall back to templates. Log every leak/failure (see testing plan). Mock provider keeps dev honest. |
| **Scoring validity** | Scores feel arbitrary → debrief loses trust → loop dies. | Only objective/rule-based scores (`ScoreBasis`), each with an explanation string; LLM coaching visually labeled as subjective; test A5 explicitly. |
| **Engagement** | One-and-done: users finish a scenario and never return. | Seeded variation, hidden info, and events make replays differ; XP + unlock path gives progression; measure replay rate per scenario in analytics. |

## Open questions

- Does difficulty ramp 1→3 feel right, or is the camera scenario too easy to teach anything?
- Is free-text chat + structured offer form the right split, or should offers be inline?
- How much LLM personality is needed before the mock provider misleads playtests?
- What single retention metric matters at this stage — replays per scenario, or lessons completed?
- When does multiplayer (async matches, ratings) become the bet — after A3 holds, or independent of it?
- Pricing/positioning: consumer self-improvement vs. B2B sales training? (Defer until P5.)

## Game design pillars

These four mechanics are what make nego a *game* rather than a chatbot with a rubric. All are deterministic and defined in scenario JSON.

1. **Phases of play** (`explore → bargain → close`): pacing structure the opponent policy uses — early turns favor questions and rapport, mid-game favors offers/counters, endgame forces convergence or walk-away. Gives sessions an arc and variable turn counts instead of a flat haggling loop.
2. **Hidden information** (`hidden_info` + `reveal_topics`): key facts (Sam's Friday deadline, the shutter count, the spare battery) surface only when the player asks about matching topics. Rewards curiosity, teaches diagnostic questioning, and feeds the discovery score. What you learn changes what a good deal looks like.
3. **Scripted events** (`events`, `threshold_delta`): mid-game surprises ("another buyer just messaged") that shift the AI's acceptance threshold up or down. Creates tension, tests composure, and breaks scripted play.
4. **Seeded variation** (`variation` + session seed): AI reservation, opening demand, and turn limit are sampled per session, so the same JSON file yields "infinite games". Replaying is a fresh puzzle, not memorization — this is the engagement engine and the basis for later ratings.

Together: hidden info makes exploration valuable, phases give it a place, events punish autopilot, and variation makes the whole thing replayable. That is the Chess.com half of the vision in miniature.
