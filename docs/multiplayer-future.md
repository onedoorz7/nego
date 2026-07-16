# Async Human-vs-Human Mode — Future Design

**Status: NOT in the current build.** This is a design note for a later asynchronous multiplayer mode, written so that near-term single-player decisions don't foreclose it. Current build stays single-player vs the deterministic AI.

---

## 1. Product shape: turn-based async matches

Think correspondence chess, not live chat. A match is a slow-burn negotiation played over days, on the player's schedule.

### Match setup
- Both players are assigned to **one scenario file, opposite roles**. Scenarios already define two full roles with `private_brief`, `preferences`, `batna`, `reservation_utility`, `target_utility` (see `src/lib/content/schema.ts` — `RoleBaseSchema` is shared by both sides). The AI-only extras (`personality`, `reveal_topics`) are simply unused for humans.
- Each side sees: `public_context` + **their own** brief. The server never sends the opponent's role object to the client — this invariant already exists in the schema contract ("Never sent to the other side") and must be enforced at the API layer, not the UI layer.
- Prep form (`preparation` fields) is completed by each side privately before their first turn, same as single-player.

### Turns and deadlines
- Strict alternation, same transcript model as today (`TranscriptEntry`: message / offer / accept / reject / walk). A "turn" = one message and/or one structured offer.
- **Response deadline: 24h per turn** (configurable per match: 12h "brisk" / 24h default / 72h "casual"). Deadline is scenario-agnostic wall-clock, paused never — simplicity beats fairness edge cases at this stage.
- **Reminders:** push/email at deadline−12h and deadline−2h. One deadline extension per match, requestable once (adds 24h, opponent is notified, no approval needed).

### Agreement confirmation (accept → confirm handshake)
Single-player `accept` is instant because the AI can't misclick or regret. With humans, use a two-step handshake:
1. Side A **accepts** the standing offer → offer is frozen (no further edits), match enters `pending_confirmation`.
2. Side B (whose offer it was) **confirms** within a short window (6h) → `agreement`. Or B can **withdraw** (allowed once per match, logged in the transcript as a visible retraction — a real negotiation move with a real reputational cost in peer feedback).
3. No confirmation within the window → auto-confirm. The offer was theirs; silence means yes.

This prevents "accept sniping" of stale offers and gives one deliberate exit ramp without making acceptance meaningless.

### Post-match role reveal — the "aha" moment
On match end (any terminal state), each side sees the **other side's full brief**: private brief, hidden info, preferences, BATNA, reservation/target. This is the emotional payoff of the whole mode — "they needed the cash by *Friday*?!" — and the single best learning artifact we can generate. Pair it with the deterministic debrief: your utility, their utility, the ZOPA, and the Pareto-better package you both missed (`DealAnalysis.pareto_improvement` already computes this).

### Abandonment and timeouts
- Missed deadline → 24h grace with a final warning → **auto-forfeit, scored as a walk-away** via the existing evaluation path (walker gets BATNA utility; the abandoned player gets BATNA utility too, plus a small consolation XP bonus and no rating penalty).
- Abandonment **strikes**: 1st = warning, 2nd within 30 days = matchmaking cooldown (48h), 3rd = async mode paused pending appeal. Strikes decay after 60 days. Deliberate strategic walk-aways (explicit `walk` action) are *not* strikes — walking away is a legitimate, sometimes optimal move and is scored as such.

### Peer feedback
- After the reveal screen, each side gives **structured tags + optional short comment**. Rate the *experience*, not the person: `[good communicator] [creative packager] [tough but fair] [slow to respond] [felt bad-faith]`.
- Tags feed a private "reliability" signal for matchmaking (never a public score — public reputation scores invite harassment and gaming). Aggregate positive tags can surface as profile badges after N occurrences.
- No numeric star rating of the human. Ever.

### Reporting & moderation basics
Free-text chat between strangers is the single biggest new risk surface. Minimum bar before launch:
- **Report button** on every message; reported matches snapshot the transcript for review.
- Automated pre-send filter (harassment/PII/contact-info exchange) — a cheap LLM classification pass; block-and-explain, don't shadow-delete.
- **Block user** (never matched again), no explanation required.
- Human review queue for reports; small at prototype scale, but the tooling (transcript viewer with both briefs visible to moderators) must exist on day one.
- Chat is scenario-scoped: nudge users that off-topic personal exchange is against ToS; disallow links.

---

## 2. Outcome scoring: same engine, no winners

**Reuse the deterministic evaluation engine unchanged.** Both roles already have complete preference/utility definitions, so `EvaluationResult` computes for each human exactly as it does for player-vs-AI: utility vs reservation, vs target, vs BATNA, joint utility, Pareto analysis.

**Explicitly no binary winner.** Both sides get 0–100 utility-based scores against *their own* role's yardsticks. A deal at 78/74 is a better performance by both players than a grinding 82/31 — and the debrief should say so (joint utility and Pareto-gap are already first-class in `DealAnalysis`). This is a load-bearing product stance: the moment we display "You won", we teach exactly the wrong lesson and invite toxic play.

---

## 3. Rating design (treated seriously)

### Why plain Elo/Glicko-2 fits poorly
Elo/Glicko assume: zero-sum outcomes, symmetric conditions, and result ∈ {win/loss/draw}. Negotiation violates all three:
1. **Non-zero-sum.** Both players can do well (or badly) simultaneously. Mapping "higher utility than opponent" to "win" is meaningless across asymmetric roles — the utilities aren't even on comparable scales.
2. **Role asymmetry.** Buyer and Seller in `used-camera-001` face different difficulty: different ZOPA position, different information (seller holds the hidden info). A raw score comparison confounds skill with role draw.
3. **Scenario difficulty variance.** A 45-utility outcome may be excellent in a difficulty-5 scenario and poor in a difficulty-1 scenario. `variation` sampling adds within-scenario variance on top.

### Proposal: skill profile, not one number
Per-player ratings on **four dimensions**, mirroring the coaching model:
- **Value claiming** — surplus captured relative to role baseline (utility vs reservation, share of ZOPA).
- **Value creation** — joint utility achieved vs `max_joint_utility`; Pareto-gap avoided; use of non-primary fields (logrolling).
- **Preparation** — prep-form quality vs brief (reservation/target set correctly, plan-vs-play consistency). Deterministic rules already exist for this in single-player.
- **Communication** — question-asking, information revealed vs protected, peer tags. Partly rule-based, partly peer-informed; the softest dimension, weight it least.

Plus **per-scenario-category ratings** (marketplace / salary / business / conflict…) so "great at haggling, weak at multi-issue packages" is visible — that's the Chess.com-style hook (tactics vs endgames) and the input to matchmaking.

### Update mechanisms (to discuss, in preference order)
**(a) Population-normalized expected-vs-actual — the workhorse.**
For each `role × scenario` cell, maintain the outcome distribution of all human matches (single-player sessions can seed priors). A match result becomes a **percentile within your role×scenario cell**, and the rating moves toward that percentile: `R' = R + K · (percentile − E(percentile | R))`. This neutralizes role asymmetry and scenario difficulty in one move, works without comparable opponents, and updates value-claiming and value-creation dimensions from different percentile bases (own-utility percentile vs joint-utility percentile). Cold-start per cell: fall back to the deterministic score's absolute scale until n ≥ ~30.

**(b) Pairwise Glicko-style updates — value claiming only, mirrored pairs only.**
Where two matches exist with roles mirrored (A-as-buyer vs B, and A-as-seller vs B, same scenario+seed — or tournament-style duplicate pairs), a genuine head-to-head comparison is valid: compare summed own-role percentiles. Apply a Glicko-style update on the **value-claiming dimension only**. This is the only setting where "beat the opponent" is well-defined; don't stretch it further. Likely a leagues/tournament feature, not the default ladder.

**(c) Uncertainty à la Glicko RD.**
Every dimension carries a rating deviation: high for new players (fast movement, wide matchmaking, "provisional" badge for the first ~10 rated matches), decaying with play, inflating with inactivity. Display conservative estimates (R − 2·RD) on ladders so fresh accounts can't top charts.

### Honest caveats and mitigations
| Attack | Mitigation |
|---|---|
| **Rating farming** (smurfs/alt-feeding) | Rated matches only via matchmaking, never by direct invite; provisional-period rating changes don't propagate to opponents. |
| **Colluding pairs** (script a mutual-max deal) | Matchmaking pairs strangers; flag statistically improbable outcomes (instant near-Pareto-optimal deals, few turns, repeated pairings); repeated-pair matches are unrated. |
| **Easy-scenario grinding** | Percentile normalization already caps this (being 90th percentile in an easy cell is hard); plus **scenario rotation** (§4) and diminishing rated-weight on repeats of the same scenario. |
| **Sandbagging** (tank rating for weak opponents) | Non-zero-sum scoring blunts the motive (your score comes from your outcome, not from beating a weak opponent); RD inflation on suspicious loss streaks; abandonments never lower rating (removes the cheap tanking lever). |
| **Brief leaking in chat** ("my reservation is X, meet me there") | Collusion detection above; also this is just… bad negotiation practice that percentiles punish naturally when done honestly. |
| Small-population percentile noise | Minimum-rated-games thresholds per cell; shrink K when cell n is small; seed cells from single-player distributions. |

---

## 4. Matchmaking & seasons

- **Match on**: value-claiming rating window (±150-ish, widened by RD and queue time) within the chosen scenario category; timezone-compatible deadline preference; reliability signal (strike-free players aren't paired with strike-heavy ones).
- **Scenario rotation**: a weekly rated pool of 3–5 scenarios per category, rotated so scenario-specific meta-knowledge decays and content keeps feeling fresh. Playing the same scenario in both roles across a season is a feature — the reveal hits differently the second time.
- **Leagues/seasons: a later layer**, deliberately deferred. Weekly leagues (Duolingo-style) over the population-normalized percentile scores; seasonal soft rating resets via RD inflation, not score resets. Duplicate-pair tournaments (mechanism (b)) belong here. None of this should influence the core data model now beyond keeping match records immutable and timestamped — which the transcript design already does.

---

## 5. Current architecture: supports vs must change

### Already supports (don't rebuild)
- **Two full roles per scenario file** — `player_role`/`ai_role` share `RoleBaseSchema`; content is multiplayer-ready today.
- **Event-log transcript with structured offers** (`TranscriptEntry`, `offer_history`, `standing_offer`) — async-native by construction; a match is a fold over events.
- **Deterministic per-role evaluation** — reusable verbatim for both humans (§2).
- **Brief privacy as a schema contract** — `private_brief` doc comment already states the invariant; hardening is enforcement work, not redesign.
- **Seeded `variation`** — both sides of a match resolve from one seed; duplicate-pair play (b) falls out for free.

### Must change / build
| Area | Work |
|---|---|
| **Roles** | Generalize `Side = "player" \| "ai"` → `"a" \| "b"`; move `personality`/`hidden_info`/`talking_points` into an optional AI-extension so any role can be played by human or AI. Hidden info for humans becomes brief content revealed *by choice* (no `reveal_topics` matching); the discovery score is dropped or LLM-tagged post-hoc in H2H. |
| **Auth/accounts** | Real accounts (none today). Table stakes before any H2H. |
| **Turn state machine** | Server-authoritative match FSM: `awaiting_a / awaiting_b / pending_confirmation / terminal·*`, with deadline timers, grace, forfeiture. New module, but it wraps the existing transcript/offer types. |
| **Notifications** | Email + push for your-turn / deadline / result. Entirely new infrastructure. |
| **Privacy hardening** | Split session state server-side: per-viewer projections of `SessionState` (opponent's brief, prep, and internal analysis never serialized to the other client — including in the reveal payload *until* terminal state). Audit every API response shape. |
| **Anti-cheat basics** | Server-side validation of all actions (turn order, offer bounds vs `offer_fields`, deadline enforcement); immutable append-only transcript; collusion/anomaly flags (§3). Accept that LLM-assisted play is undetectable — frame it as allowed ("bring a coach"), and let ratings measure outcomes, not purity. |
| **Moderation tooling** | Report/block, pre-send filter, mod transcript viewer (§1). New. |
| **Rating service** | Per-cell outcome distributions, percentile computation, dimension ratings + RD. New, but pure functions over match records — keep it replayable from the event log so the algorithm can be revised retroactively. |

---

## 6. Recommendation: whether and when

**Build it later; design for it now (this doc); test it cheaply first.**

1. **Gate on single-player retention.** Async H2H only makes sense with a pool of returning players (async needs liquidity; dead queues kill the mode on contact). Wait for a clear single-player signal — e.g. W4 retention and lesson-path completion trending well — before writing multiplayer code.
2. **Prototype with founder-vs-friends manual matches first.** Before any of §5: run 10–20 matches over email/Slack/Google Docs using existing scenario files — hand each person their role's brief, alternate turns manually, run the evaluator on the final package, then do the role reveal in person. This costs days, not months, and answers the three real risks: *Is a 24h-turn negotiation fun or does it die of latency? Is the role reveal the aha we think it is? Do people negotiate in good faith with strangers?* No rating system, no matchmaking, no moderation needed to learn all three.
3. **Then** ship a minimal invite-only ladder (auth + FSM + notifications + privacy hardening + report/block), with scoring but **no ratings for the first season** — collect the outcome distributions that mechanism (a) needs, and launch ratings only once the per-cell data exists.

The current build should absorb exactly two cheap decisions from this doc: keep the transcript append-only and server-replayable, and never let a client payload include the other role's private data. Everything else can wait.
