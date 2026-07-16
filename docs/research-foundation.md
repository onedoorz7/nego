# Research Foundation

The research matrix grounding nego's curriculum and scoring. One subsection per concept: what it is, why we teach it, what it looks like in a transcript, how our deterministic engine simulates it, and how we could measure it honestly.

**How to read the measurement bullets.** Product principle: the LLM never owns facts, constraints, offers, or numeric scores (see `src/lib/content/schema.ts`). So every measure is tagged:

- **[D]** — fully deterministic: computed from structured game data (offers submitted via `offer_fields`, utilities, `hidden_info` unlocks, turn numbers, prep-form entries, event state).
- **[L]** — needs transcript classification: an LLM labels utterances (e.g. "this is an open question"), then deterministic code maps labels to points via a fixed rubric. Labels are auditable; numbers never come from the model.

Citations were web-checked July 2026 unless marked **(verify)**. Scenario references are to `content/scenarios/used-camera-001.json` ("the camera scenario").

---

## Core framework

### Principled negotiation
- **Definition:** Fisher & Ury's four-part method: separate the people from the problem; focus on interests, not positions; invent options for mutual gain; insist on objective criteria.
- **Why it matters:** It is the closest thing to a shared vocabulary in negotiation education — our lesson path's spine and the frame most users will half-know already.
- **Observable behavior in a transcript:** Player asks why the counterpart wants something, proposes multi-issue options, justifies numbers with external standards, and keeps tone civil after friction.
- **Common mistake:** Reading it as "be nice / split the difference." Principled ≠ soft: Fisher & Ury explicitly reject soft bargaining.
- **How it appears in our simulations:** It's the umbrella, not a single mechanic — `concepts` tags, lesson ordering, and the prep form (`goal`, `questions`, `avoid_reveal`) walk players through it before each game.
- **How we could measure it:** As a composite only: roll up the sub-measures below (question quality [L], hidden-info discovery [D], criteria citations [L], multi-issue offers [D]). Never a single "principled score."
- **Measurement limitations / validity caveats:** It's a prescriptive framework, not one behavior; the package itself has surprisingly little direct experimental testing (its components do). A composite hides which sub-skill moved.
- **Sources:** Fisher, Ury & Patton, *Getting to Yes* (1981/2011).

### Interests vs positions
- **Definition:** A position is what someone says they want ("$520"); an interest is why they want it (cash before Friday's lens pre-order). Multiple positions can satisfy one interest.
- **Why it matters:** Interests are where trades live. Positional haggling can only split; interest discovery can expand.
- **Observable behavior in a transcript:** "Why are you selling?" / "What matters most to you here?" versus repeating numbers louder.
- **Common mistake:** Stating your own position more forcefully instead of probing theirs; assuming their interest is the mirror image of yours.
- **How it appears in our simulations:** `hidden_info` is interests made mechanical: Sam's Friday cash need (`needs_cash_friday`, importance 3) only surfaces if the player probes matching `reveal_topics`.
- **How we could measure it:** [D] % of hidden_info unlocked, importance-weighted (schema already supports this). [L] ratio of interest-seeking utterances to positional restatements.
- **Measurement limitations / validity caveats:** Keyword matching creates false positives (player says "why" incidentally) and rewards topic-spamming; the [L] classifier will mislabel indirect probes. Track unlock *timing* and question quality, not raw counts.
- **Sources:** Fisher, Ury & Patton (1981/2011); Thompson, *The Mind and Heart of the Negotiator*.

### BATNA
- **Definition:** Best Alternative To a Negotiated Agreement — the course of action you take if talks fail (Fisher & Ury's coinage).
- **Why it matters:** Your BATNA, not your wishes, sets your real walk-away point and your power. Nuance: a *weak* BATNA can hurt more than none, by anchoring you low (Schaerer et al., 2015).
- **Observable behavior in a transcript:** Player references their alternative credibly (without over-disclosing), declines deals worse than it, and doesn't panic when the counterpart stalls.
- **Common mistake:** Negotiating without ever identifying the alternative; or treating a stated BATNA as fixed instead of something to strengthen before talking.
- **How it appears in our simulations:** Every role carries `batna.{description, utility}`; the buyer's $475 cross-town listing is worth utility 45. Walking away scores the BATNA utility, so quitting is a real, sometimes-correct move. Prep field `batna` asks the player to articulate it first.
- **How we could measure it:** [D] Prep-vs-brief accuracy (did they identify the $475 listing?); acceptance discipline (deal utility ≥ `batna.utility`?); walk-away correctness (see Impasse management).
- **Measurement limitations / validity caveats:** In-sim BATNAs are handed to the player; the real-world skill of *building* alternatives before negotiating is out of scope and our scores can't claim to measure it.
- **Sources:** Fisher, Ury & Patton (1981/2011); Schaerer, Swaab & Galinsky, *Psychological Science* (2015).

### Reservation value
- **Definition:** The worst deal you'd still accept — the indifference point between dealing and taking your BATNA. (Buyer's brief: $460 hard cap.)
- **Why it matters:** Without a pre-committed reservation point, anchors and momentum drag people past it ("agreement bias").
- **Observable behavior in a transcript:** Player sets it in prep, then actually honors it — no acceptance at $480 "because we were so close."
- **Common mistake:** Confusing reservation with target ("I'd like $430" is not "I must stay under $460"); moving the cap mid-game under pressure.
- **How it appears in our simulations:** `reservation_utility` per role (buyer 45, seller 22 ± variation); prep field `reservation` records the player's number against the brief's implied cap.
- **How we could measure it:** [D] Plan calibration: |prep reservation − brief-implied cap|. [D] Discipline: accepted-deal utility ≥ `reservation_utility`? Flag any acceptance below it as the debrief's headline error.
- **Measurement limitations / validity caveats:** A single dollar number on `primary_field` ignores multi-issue tradeoffs — $470 *with* battery and bag can beat $460 bare, and our utility model knows that even if the player's stated cap doesn't. Score against utility, coach in dollars.
- **Sources:** Raiffa, *The Art and Science of Negotiation* (1982); Bazerman & Neale, *Negotiating Rationally* (1992).

### ZOPA
- **Definition:** Zone Of Possible Agreement — the range between the two reservation points. Deals are only possible inside it.
- **Why it matters:** Frames the two failure modes we score: impasse when a ZOPA existed, and settling at the wrong end of it.
- **Observable behavior in a transcript:** Not directly observable to players (that's the point) — inferred from probing for the other side's limits and calibrating offers to what's plausible.
- **Common mistake:** Assuming no deal is possible after one aggressive counter; or assuming a ZOPA must exist and conceding until "yes."
- **How it appears in our simulations:** Exists by construction from both `reservation_utility` values; `variation` ranges (seller reservation 18–28) shrink or widen it across replays so players can't memorize the zone.
- **How we could measure it:** [D] Surplus split: where the final deal landed between the two reservation utilities. [D] Impasse-despite-ZOPA flag. Both are exact because we own both utility schedules — our core scoring advantage over human-roleplay training.
- **Measurement limitations / validity caveats:** Surplus split inherits every flaw in our authored utility weights; a single game is a noisy skill signal (variance in AI sampling, events). Report per-game, rate across many games — the Chess.com model.
- **Sources:** Raiffa (1982); Lax & Sebenius, *The Manager as Negotiator* (1986) **(verify)**.

---

## Opening and claiming value

### Anchoring & first-offer effects
- **Definition:** First numbers pull final outcomes toward themselves (anchoring; Tversky & Kahneman, 1974). In negotiation, first-offer magnitude correlates strongly with agreement value.
- **Why it matters:** Best-quantified effect in the field. 2025 meta-analysis (90 studies, N=16,334): first-mover advantage g = 0.42; first-offer magnitude ↔ agreement value r = .62; ambitious-vs-moderate first offers g = 1.14 — but ambitious offers also raise impasses (g = −0.42) and hurt the recipient's felt outcome (g = −0.40).
- **Observable behavior in a transcript:** Who states the first number, how far it sits from that side's best case, and whether the responder re-anchors versus counters near the anchor.
- **Common mistake:** Two symmetric ones: opening at (or beyond) your own reservation point, and anchoring blind when the other side has better information (Galinsky & Mussweiler's counter-move: focus on your target and their reservation point to defuse a received anchor).
- **How it appears in our simulations:** `personality.opening_demand` (Sam: 0.78–0.92 of his best corner) and `patience` (3 turns before Sam opens) let scenarios vary who anchors and how hard; prep field `opening` records the plan.
- **How we could measure it:** [D] Whether the player opened first; opening distance from their best corner; plan adherence (planned vs actual opening); final price's distance from each side's anchor.
- **Measurement limitations / validity caveats:** These are average effects — don't score "always anchor first" as universally correct. Reward *calibrated* ambition (near-but-inside plausibility), and let the impasse/relationship costs show up in other scores so the tension stays visible.
- **Sources:** Galinsky & Mussweiler, *JPSP* 81, 657–669 (2001); Petrowsky et al., *OBHDP* (2025) meta-analysis; Guthrie & Orr, *Ohio St. J. on Dispute Resolution* (2006) meta-analysis; Tversky & Kahneman, *Science* (1974).

### Precise vs round offers
- **Definition:** Precise numbers ($487) anchor harder than round ones ($500) — they signal informedness — but *hyper*-precision backfires with experts (inverted-U: the "too-much-precision effect").
- **Why it matters:** A cheap, teachable, immediately usable tactic — exactly the kind of "power-up" that makes a gamified lesson land. Also a clean case study in boundary conditions.
- **Observable behavior in a transcript:** Offer granularity ($460 vs $465 vs $463) and whether precise offers draw smaller counter-adjustments.
- **Common mistake:** Treating precision as magic — using $487.50 on a pro who reads it as posturing, or precision without a rationale to back it.
- **How it appears in our simulations:** Weakly, today: the camera scenario's price `step` is 5, which *prevents* fine-grained precision play. Product note: precision-focused scenarios need `step: 1` and personas varying in expertise (amateur Sam vs. a dealer) so the boundary condition is playable.
- **How we could measure it:** [D] Offer precision (trailing-zero / modulo analysis) and the AI's counteroffer adjustment size, which our engine controls and can condition on precision + persona expertise.
- **Measurement limitations / validity caveats:** Effects are real but modest and moderated (expertise, rationale); if we hard-code "precise offer → smaller AI concession" we're simulating the finding, not testing the player — fine for teaching, but say so in the debrief.
- **Sources:** Loschelder et al., "€14,875?! Precision boosts the anchoring potency of first offers," *Social Psychological & Personality Science* (2014) **(verify exact journal)**; Loschelder, Friese, Schaerer & Galinsky, "The too-much-precision effect," *Psychological Science* (2016); Mason et al., *JESP* (2013) **(verify)**.

### Concession patterns & reciprocity
- **Definition:** How offers move over time. Concessions trigger a reciprocation norm (Cialdini's "rejection-then-retreat": 50% vs 17% compliance); shrinking concession sizes signal an approaching limit.
- **Why it matters:** Concession choreography is most of what a distributive endgame *is*. Players who concede in big, un-reciprocated jumps give away the ZOPA.
- **Observable behavior in a transcript:** Concession count, sizes, decay pattern; whether the player concedes only after the AI moves; label-your-concession language ("I can do 440, but only if the battery's included").
- **Common mistake:** Bidding against yourself (two moves in a row), equal-sized concessions (reads as "more where that came from"), and conceding without asking for anything back.
- **How it appears in our simulations:** The AI's side is explicit: `concession_rate` decays its acceptance threshold from target toward reservation each turn; `events.threshold_delta` bends the curve mid-game (the turn-6 rival buyer stiffens Sam by +4).
- **How we could measure it:** [D] Entirely from structured offers: concession curve per side, decay monotonicity, self-bidding flags, reciprocation ratio (player moves following AI moves). This is our richest deterministic signal.
- **Measurement limitations / validity caveats:** No single "correct" curve exists — the right pattern depends on time costs and power; over-rubricizing breeds robotic play. Score anti-patterns (self-bidding, giant late concessions) confidently; score "ideal shape" gently.
- **Sources:** Cialdini et al., "Reciprocal concessions procedure for inducing compliance," *JPSP* (1975); Pruitt, *Negotiation Behavior* (1981) **(verify)**.

---

## Creating value

### Distributive vs integrative negotiation
- **Definition:** Distributive = claiming shares of a fixed pie (pure price haggle). Integrative = enlarging the pie via differences in priorities, beliefs, or valuations (Walton & McKersie's original distinction).
- **Why it matters:** Almost every real deal is both at once — create value, then claim it — and the tension between the two ("the negotiator's dilemma") is the game's central drama.
- **Observable behavior in a transcript:** Whether the player ever leaves the price axis: bundling, asking what else is available, trading across issues.
- **Common mistake:** Playing every negotiation as pure price war; or its inverse — being so "win-win" that you create value and let the other side claim all of it.
- **How it appears in our simulations:** Structurally, via `offer_fields` + asymmetric `preferences`: price is near zero-sum, but extras are worth 0.15 weight to the buyer and only 0.1 to the seller (who values the spares near nothing) — pie expansion is authored into the utility schedules.
- **How we could measure it:** [D] Joint utility of the final deal vs the Pareto frontier we can compute exactly from both preference schedules; Pareto-efficiency flag ("a deal existed that was better for BOTH of you").
- **Measurement limitations / validity caveats:** The frontier is designer-authored — integrative skill can only be displayed up to the value we hid in the scenario. Efficiency stats need that context ("of the value available, you captured…").
- **Sources:** Walton & McKersie, *A Behavioral Theory of Labor Negotiations* (1965) **(verify)**; Lax & Sebenius (1986) **(verify)**; Thompson, *The Mind and Heart of the Negotiator*.

### Fixed-pie bias
- **Definition:** The default assumption that the other side's interests are exactly opposed to yours — so no trades exist worth looking for (Thompson & Hastie: negotiators systematically misjudge counterpart payoffs, even missing fully *compatible* issues).
- **Why it matters:** It's the cognitive root of missed integrative value; the bias fades during a negotiation only if people actually test their assumption.
- **Observable behavior in a transcript:** Never asking what the extras are worth to Sam; refusing "throw in the bag" framings as concessions rather than trades; surprise in the debrief that Sam barely valued the spares.
- **Common mistake:** Projecting your own priority weights onto the counterpart — assuming Sam guards the battery as jealously as the price.
- **How it appears in our simulations:** Sam's `spare_extras` hidden info ("worth little to me, happy to throw them in") is bait: a fixed-pie player never finds it because they never ask.
- **How we could measure it:** [L→D] Debrief quiz: "what did Sam care about most / least?" scored deterministically against his actual `preferences`. [D] Proxy: zero offers varying a non-primary field across the whole game.
- **Measurement limitations / validity caveats:** Absence of trades isn't proof of bias (may be strategy or time pressure); real bias measurement needs payoff estimation à la Thompson & Hastie, which adds friction — keep it to occasional debrief quizzes, not every game.
- **Sources:** Thompson & Hastie, "Social perception in negotiation," *OBHDP* 47, 98–123 (1990) **(verify exact figures before quoting them in lessons)**; Bazerman & Neale (1992).

### Package offers & MESOs
- **Definition:** Package offers bundle all issues into one proposal instead of settling issue-by-issue. MESOs = Multiple Equivalent Simultaneous Offers — presenting 2–3 packages you value equally.
- **Why it matters:** Issue-by-issue settling kills logrolling. MESOs improve economic *and* relational outcomes and leak the counterpart's priorities through which package they prefer (Leonardelli et al.: six experiments; ~3 offers is the sweet spot per Medvec & Galinsky).
- **Observable behavior in a transcript:** Offers that specify every issue at once; "Option A: $450 bare / Option B: $475 with battery + bag — which works better?"
- **Common mistake:** Nailing down price first, then discovering the extras conversation has no room left; offering alternatives that aren't actually equivalent to you.
- **How it appears in our simulations:** Half-built: our offer form is inherently a package (every `offer_fields` value submitted together — good default). True MESOs aren't supported — the UI submits one offer at a time. Roadmap candidate: multi-offer submission with a deterministic check that the player's options are within ±ε of each other in their own utility.
- **How we could measure it:** [D] Today: % of offers that vary a non-price field. [D] Later: MESO feature usage + equivalence check + whether the player exploited the preference information the AI's choice revealed.
- **Measurement limitations / validity caveats:** With only two offer fields the package space is tiny; MESO evidence comes from richer multi-issue lab tasks — build 3–4-issue scenarios before claiming to teach this.
- **Sources:** Leonardelli, Gu, McRuer, Medvec & Galinsky, *OBHDP* 152, 64–83 (2019); Medvec & Galinsky practitioner work via PON/Kellogg **(verify original cite)**.

### Logrolling
- **Definition:** Trading a low-priority issue for a high-priority one when parties weight issues differently. The classic demonstration: simultaneous multi-issue bargaining beats issue-by-issue compromise (Froman & Cohen, 1970).
- **Why it matters:** It's the concrete *mechanism* behind "win-win" — the thing integrative talk cashes out as.
- **Observable behavior in a transcript:** Explicit trade framing: "I'll come up $15 if you include the battery and bag."
- **Common mistake:** Compromising down the middle on every issue separately — which feels fair and reliably leaves joint value on the table.
- **How it appears in our simulations:** The camera scenario embeds one logroll: extras cost Sam ~nothing (option_values 1 → 0.5 at 0.1 weight) but are worth real utility to the buyer (0 → 0.6 at 0.15 weight, ~$70 of retail value). Paying slightly more *with* extras beats a lower bare price for both sides.
- **How we could measure it:** [D] Did the final deal exploit the authored asymmetry (extras included, both utilities above the price-only equivalent)? [D] Joint-utility gain over the best same-price bare deal.
- **Measurement limitations / validity caveats:** One authored logroll per scenario means "found it or didn't" — a binary, luck-contaminated signal per game. Can't distinguish intent from accident; measure outcomes, coach the asking-behavior that reliably finds trades.
- **Sources:** Froman & Cohen, *Behavioral Science* 15, 180–183 (1970); Pruitt (1981) **(verify)**.

### Contingent agreements
- **Definition:** "Bets" that resolve disagreements about the future instead of arguing them flat ("if it needs a repair within 30 days, you refund $50"). Bazerman & Gillespie: they turn differing predictions into deal material, share risk, and screen out bluffs.
- **Why it matters:** Advanced but high-leverage; differences in *beliefs* are a value source just like differences in priorities.
- **Observable behavior in a transcript:** If-then proposals tied to verifiable future events; offering a guarantee instead of arguing about condition claims.
- **Common mistake:** Arguing endlessly over whose forecast is right; or accepting a contingency you can't verify or enforce.
- **How it appears in our simulations:** Not yet — and it's a real constraint: a deterministic engine needs resolvable uncertainty. Feasible path: encode contingencies as select `offer_fields` ("7-day return right: yes/no") with option_values reflecting each side's private beliefs about the event. Until then, the dialogue LLM must be constrained from improvising contingencies the engine can't enforce.
- **How we could measure it:** [L] Detect contingent proposals in free text (coaching signal only). [D] Once contingency fields exist: usage and utility impact, fully deterministic.
- **Measurement limitations / validity caveats:** Highest gap between concept richness and engine support; scoring free-text contingencies would violate the determinism principle, so this stays coach-only until the schema grows.
- **Sources:** Bazerman & Gillespie, "Betting on the future: The virtues of contingent contracts," *HBR* 77(5), 155–160 (1999); Malhotra & Bazerman, *Negotiation Genius* (2007).

---

## Information and process

### Active listening & information exchange
- **Definition:** Eliciting, acknowledging, and *using* what the counterpart says. Information sharing is strongly reciprocal — in Thompson's studies, disclosure rates jumped from ~20% to ~55% when the other party disclosed first.
- **Why it matters:** Information exchange is the single most reliable route to integrative agreement in the lab literature; listening is how the exchange gets paid for.
- **Observable behavior in a transcript:** Paraphrasing ("so the timing matters more than the last $20?"), follow-ups that reference earlier AI statements, strategic self-disclosure of own priorities.
- **Common mistake:** Talking past the counterpart — asking a question, ignoring the answer, restating the offer; hoarding all information while expecting theirs.
- **How it appears in our simulations:** The `hidden_info` mechanic is active listening made into a game loop: facts surface only when player messages hit `reveal_topics`, and `talking_points` reward casual rapport-chat too.
- **How we could measure it:** [D] Importance-weighted % of hidden_info unlocked + unlock timing (already schema-supported). [L] Acknowledgment/paraphrase detection; whether unlocked facts were *used* in later offers (e.g., Friday deadline → time-based framing).
- **Measurement limitations / validity caveats:** Substring matching is a blunt listening proxy — players can keyword-fish without listening; consider requiring conversational coherence ([L] check) before an unlock scores. Discovery ≠ utilization; measure both.
- **Sources:** Thompson, "Information exchange in negotiation," *JESP* 27, 161–179 (1991); Weingart, Hyder & Prietula, *JPSP* (1996) **(verify pages)**.

### Diagnostic questions
- **Definition:** Questions that surface the counterpart's interests, constraints, and priorities — "why are you selling?" rather than "will you take $430?" Malhotra & Bazerman's "investigative negotiation" stance.
- **Why it matters:** The highest-leverage 10 seconds in most negotiations; in our data model, one good "why" question can unlock the importance-3 fact that reshapes the whole game.
- **Observable behavior in a transcript:** Open questions early; "what would make this easy for you?"; probing the story behind a stated constraint instead of accepting it.
- **Common mistake:** Only asking positional yes/no questions; front-loading offers before any discovery; treating questions as stalling rather than strategy.
- **How it appears in our simulations:** `reveal_topics` are literally a curriculum of good questions ("why", "selling", "timeline" → `needs_cash_friday`); prep field `questions` makes the player plan them before the game.
- **How we could measure it:** [D] Unlock count/timing per importance tier; prep-plan-vs-execution (did they ask what they planned?). [L] Open-vs-closed-vs-leading classification of player questions.
- **Measurement limitations / validity caveats:** Question *count* is gameable and weakly tied to skill; players will learn to interrogate our engine's keyword surface rather than a human's psychology — rotate reveal_topics phrasing via variation, and keep [L] quality checks in the loop.
- **Sources:** Malhotra & Bazerman, *Negotiation Genius* (2007); Miles, "Developing strategies for asking questions in negotiation," *Negotiation Journal* (2013) **(verify)**.

### Objective criteria
- **Definition:** Independent standards — market comps, expert benchmarks, precedent — used to justify positions instead of raw will ("recent sold listings run $430–490").
- **Why it matters:** Standards make concessions face-saving ("I'm not caving, I'm agreeing with the data") and defuse contests of stubbornness; a core Getting-to-Yes pillar.
- **Observable behavior in a transcript:** Citing the comps from the brief; asking Sam how he priced it; countering an anchor with data rather than an equally arbitrary number.
- **Common mistake:** Quoting no evidence at all; or cherry-picking a standard so self-serving it reads as bad faith and hardens the other side.
- **How it appears in our simulations:** Briefs seed criteria deliberately: the buyer gets sold-listing comps and the $700 new price; Sam's `low_shutter_count` is a condition standard the *player* can elicit and then must price in.
- **How we could measure it:** [D-ish] Match player messages against the known criteria strings/entities from the brief (comps, new price, shutter count) — deterministic given authored facts. [L] Broader detection of standard-based justification.
- **Measurement limitations / validity caveats:** We can detect *citing* criteria, not whether it persuaded — our AI's response to criteria is whatever we script, so effectiveness is authored. Empirical support for criteria-use is more practice-consensus than controlled experiment; grade generously.
- **Sources:** Fisher, Ury & Patton (1981/2011); Raiffa (1982).

---

## People, power, and pressure

### Fairness perceptions
- **Definition:** Deals are judged against fairness intuitions, not just utility — people reject profitable-but-insulting offers (ultimatum game: low offers get vetoed at real cost to the rejecter).
- **Why it matters:** Explains why lowballs backfire and why the *recipient* of an ambitious first offer feels worse about the deal (Petrowsky meta: g = −0.40 on recipient subjective value). Felt fairness predicts future dealings better than economic terms (Curhan's subjective-value findings).
- **Observable behavior in a transcript:** Offer framing and justification; reactions to lowballs; whether the player leaves the counterpart a face-saving path.
- **Common mistake:** Maximizing this deal's surplus while trashing the perceived fairness that determines whether there's a next deal — or an impasse in this one.
- **How it appears in our simulations:** Authored, not emergent: Sam's `style_prompt` makes lowballs cool him visibly, `lowball_last_week` foreshadows it, and event-driven `threshold_delta` can price relational damage into the engine.
- **How we could measure it:** [D] Deterministic "irritation" state machine (offer below X → cooler tone flag + threshold shift) exposed in the debrief. [D] Post-game player survey modeled on Curhan's SVI (instrumental / self / process / relationship) as a self-report layer.
- **Measurement limitations / validity caveats:** Our AI's fairness reactions are designed, so "relationship score" measures compliance with our design, not real interpersonal skill; SVI is self-report from the player, not the counterpart's actual perception.
- **Sources:** Güth, Schmittberger & Schwarze, *J. Economic Behavior & Organization* (1982) **(verify)**; Curhan, Elfenbein & Xu, "What do people value when they negotiate?" *JPSP* 91, 493–512 (2006); Petrowsky et al. (2025).

### Trust & relationship
- **Definition:** Willingness to be vulnerable to the counterpart based on positive expectations. Meta-analytically, trust promotes integrative behavior and both economic and relational outcomes (Kong, Dirks & Ferrin).
- **Why it matters:** Trust is the lubricant for the information exchange everything above depends on; relationship value often outlasts single-deal surplus.
- **Observable behavior in a transcript:** Rapport building, honoring small commitments across turns, measured self-disclosure, no caught-out contradictions.
- **Common mistake:** Pure-transaction mode with a repeat-relationship counterpart; or over-trusting — disclosing the $460 cap in turn two.
- **How it appears in our simulations:** Thinly, today: persona warmth and lowball-cooling approximate it. Roadmap: a deterministic relationship meter (state variable moved by defined triggers: insults, reciprocity, honesty) that feeds AI threshold and shows in the debrief; repeat-counterpart scenario arcs for the long game.
- **How we could measure it:** [L] Rapport-behavior labeling (greeting, acknowledgment, disclosure) → [D] rubric points; [D] relationship-meter trajectory once built; [D] contradiction detection against the player's own brief.
- **Measurement limitations / validity caveats:** Single-round games structurally undervalue trust; an LLM rewarding "warm words" breeds sycophantic play — tie relationship scoring to *actions* (reciprocity, honesty) not tone.
- **Sources:** Kong, Dirks & Ferrin, "Interpersonal trust within negotiations: Meta-analytic evidence," *Academy of Management Journal* 57(5), 1235–1255 (2014); Thompson, *The Mind and Heart of the Negotiator*.

### Power & alternatives
- **Definition:** Negotiation power flows mainly from alternatives (BATNA strength), information, and the other side's dependence. Twist: a weak alternative can be worse than none — it anchors your aspirations down (Schaerer, Swaab & Galinsky).
- **Why it matters:** Players must learn to *diagnose* the power balance, not assume it: the seller's low reservation (22) plus Friday deadline makes the buyer stronger than the $520 sticker suggests.
- **Observable behavior in a transcript:** Confident-but-civil ambition when strong; not volunteering weakness; noticing and repricing after power shifts (the rival-buyer event).
- **Common mistake:** Equating the counterpart's confidence with actual power; letting a mediocre fallback cap your target; conceding immediately when an event flexes against you.
- **How it appears in our simulations:** Power is the geometry of `batna.utility` + `reservation_utility` on both sides; `events.threshold_delta` moves it mid-game; `variation` shuffles it between replays so players must re-diagnose each time.
- **How we could measure it:** [D] Surplus share vs a power-index baseline (relative reservation positions): did the stronger-positioned player capture accordingly? [D] Behavior delta after power-shift events.
- **Measurement limitations / validity caveats:** Real power is multi-dimensional (status, information, time, legitimacy); our scalar utilities flatten it. A "you should have captured X%" baseline is a modeling choice, not ground truth — present as coaching, not verdict.
- **Sources:** Fisher, Ury & Patton (1981/2011); Schaerer, Swaab & Galinsky, *Psychological Science* (2015); Magee, Galinsky et al. on power and first offers **(verify)**.

### Deadlines & time pressure
- **Definition:** Time limits compress concession-making. Counterintuitive findings: final deadlines can *help* the time-pressured party, and *revealing* your deadline generally beats hiding it — the constraint binds both sides once known.
- **Why it matters:** Practitioner folklore ("never reveal your deadline") is contradicted by the research — a perfect myth-busting lesson. Sam's hidden Friday deadline is the scenario's crown jewel.
- **Observable behavior in a transcript:** Probing the counterpart's timeline; using a discovered deadline in offer framing ("cash in hand today"); pacing concessions against the turn budget rather than dumping them at the buzzer.
- **Common mistake:** Panic-conceding as the limit nears; never asking about the other side's clock; hiding one's own deadline on instinct when disclosure would speed reciprocal concessions.
- **How it appears in our simulations:** Two layers: `turn_limit` (10–12 via variation) pressures the player; Sam's `needs_cash_friday` hidden info (importance 3) pressures the AI — but only benefits players who find it. Events reference the deadline to keep it live.
- **How we could measure it:** [D] Deadline-info unlock + subsequent price movement delta; concession size by turn number (late-panic signature); settlement turn vs turn_limit.
- **Measurement limitations / validity caveats:** Turn counts are a cartoon of real time pressure (no waiting costs, no calendar anxiety); the reveal-your-deadline findings come from settings where delay was costly to both — don't over-generalize the lesson.
- **Sources:** Moore, "The unexpected benefits of final deadlines in negotiation," *JESP* (2004); Gino & Moore, "Using final deadlines strategically in negotiation" / "Why negotiators should reveal their deadlines," *Negotiation & Conflict Management Research* (2008).

### Impasse management
- **Definition:** Handling no-deal trajectories: distinguishing a *good* walk (best available deal is below your reservation) from a *bad* one (value on the table, ego in the way), and de-escalating distributive spirals before they burn the ZOPA.
- **Why it matters:** Ambitious tactics raise impasse risk (meta-analytic g = −0.42) — students need the counterweight skill; and agreement bias (deal-hunger) needs the opposite counterweight.
- **Observable behavior in a transcript:** Responding to a walk-away warning by changing approach (new question, package reframe) rather than repeating the rejected number; walking cleanly when the math says walk.
- **Common mistake:** Both tails: capitulating to avoid any impasse, and torching a live deal over the last $10 of a $450 purchase.
- **How it appears in our simulations:** `warns_before_walking` gives one scripted recovery window; players can walk anytime and score their BATNA utility; `variation` can push the seller's reservation high enough that some sessions are near-no-ZOPA — walking becomes the *right* answer sometimes.
- **How we could measure it:** [D] Classify every non-deal exactly: good walk vs bad walk (we know both reservation utilities and the last offer on the table). [D] Post-warning behavior change; utility sacrificed relative to best rejected offer.
- **Measurement limitations / validity caveats:** If every scenario has a comfortable ZOPA, we secretly train "always close" — we must ship genuinely deal-shouldn't-happen sessions or the walk-away lesson is theater. Impasse *cause* attribution (who spiraled?) is murkier than impasse classification.
- **Sources:** O'Connor & Arnold, "Distributive spirals," *OBHDP* (2001) **(verify)**; Petrowsky et al. (2025); Bazerman & Neale (1992) on agreement bias.

### Negotiation ethics (bluffing norms)
- **Definition:** Where the practice community draws lines: puffery and guarding your reservation price are broadly accepted; *factual* misrepresentation, fake alternatives, and manipulation are not (SINS-scale research maps this five-factor lay taxonomy).
- **Why it matters:** A negotiation trainer that never addresses lying teaches by omission; users will ask "can I just make up a competing offer?" and we need a researched answer.
- **Observable behavior in a transcript:** Deflecting reservation-price probes without lying ("I have a budget I need to respect"); citing the real $475 alternative vs inventing a fake $400 one.
- **Common mistake:** Believing effective negotiation requires lying; or, inversely, answering every direct question fully ("what's the most you'd pay?" → "$460") — candor and disclosure are different duties.
- **How it appears in our simulations:** Prep field `avoid_reveal` teaches legitimate information guarding; the buyer's brief contains a *real* alternative so honest leverage exists; design rule: our AI never lies about scenario facts (bluffing about its limits is allowed — mirroring the norm).
- **How we could measure it:** [L] Flag player claims contradicting their own brief (fabricated offers, fake constraints) — surfaced as coaching, never as a numeric penalty. [D] Reveal-discipline: did the stated cap leak verbatim?
- **Measurement limitations / validity caveats:** Automated moral scoring is a minefield — norms are culture- and context-dependent, and a false "you lied" accusation destroys product trust. Coach ethics, score only information discipline.
- **Sources:** Robinson, Lewicki & Donahue, "Extending and testing a five factor model… the SINS scale," *J. Organizational Behavior* (2000) **(verify pages)**; Lewicki et al., *Essentials of Negotiation* ethics chapters **(verify)**.

### Multi-party basics (brief)
- **Definition:** Three-plus parties add coalitions, shifting BATNAs (your alternative may be a deal with a different party), process/agenda control, and voting dynamics (Raiffa's treatment is the classic).
- **Why it matters:** Later-curriculum material; also quietly present now — the rival-buyer event is a proto-third-party changing Sam's alternatives.
- **Observable behavior in a transcript:** (future) Coalition-seeking, agenda proposals, attention to who can block a deal.
- **Common mistake:** Treating a multi-party negotiation as a sequence of independent dyads; ignoring that the strongest coalition partner sets your price.
- **How it appears in our simulations:** Out of MVP scope — the schema is strictly dyadic (`player_role`/`ai_role`). Third parties enter only as scripted `events`. A future multi-party mode is a schema redesign, not an increment.
- **How we could measure it:** Not yet. When built: [D] coalition value capture vs Shapley-style baselines is a natural deterministic fit.
- **Measurement limitations / validity caveats:** None yet, beyond honesty that events-as-third-parties simulate pressure, not multi-party skill.
- **Sources:** Raiffa (1982); Thompson, *The Mind and Heart of the Negotiator*, multiparty chapters.

---

## Strength of evidence

Honest tiers, so we know which lessons to state as fact, which as guidance, and which as our own bets.

### 1. Well-established (state as fact in lessons)
- **Anchoring / first-offer magnitude effects** — meta-analytic, large (r = .62 magnitude↔outcome; Petrowsky et al. 2025; Guthrie & Orr 2006).
- **Fixed-pie bias exists and costs money** — replicated for 35 years (Thompson & Hastie 1990 onward).
- **Logrolling and multi-issue packaging beat issue-by-issue compromise** (Froman & Cohen 1970; large follow-up literature).
- **Information exchange and disclosure reciprocity drive joint gains** (Thompson 1991).
- **Concession reciprocity norm** (Cialdini et al. 1975).
- **Trust improves integrative behavior and outcomes** — meta-analytic (Kong et al. 2014).
- **People reject unfair-feeling offers at personal cost**; subjective value predicts future dealings (ultimatum literature; Curhan et al. 2006).
- **MESOs improve economic and relational outcomes** (Leonardelli et al. 2019 — six experiments, one team, so a half-notch below the meta-analytic rows).

### 2. Practically useful but disputed or boundary-conditioned (teach with the caveats)
- **"Always make the first offer"** — the advantage is average, not universal: it costs impasses (g = −0.42) and recipient goodwill (g = −0.40), and anchoring blind against a better-informed counterpart can backfire.
- **Precise offers anchor harder** — real, but inverted-U with expert counterparts (too-much-precision effect) and modest in size.
- **Reveal your deadline** — replicated but from one research lineage (Moore; Gino & Moore) in settings where delay cost both sides; folklore says the opposite, so teach it as myth-busting with scope limits.
- **Weak BATNA worse than none** (Schaerer et al. 2015) — striking, but young and lab-based.
- **Objective criteria persuade** — core practitioner consensus, thin controlled-experiment base.
- **Principled negotiation as a package** — components are evidenced; the four-pillar bundle itself is prescriptive synthesis, not a tested treatment.
- **Ideal concession choreography** ("never first", "always shrink") — folklore-heavy; only the anti-patterns (self-bidding, un-reciprocated giving) are safely scoreable.

### 3. Our own experimental product assumptions (bets to validate with our data)
- **Linear-additive utilities (weighted 0–1 fields) adequately encode negotiation stakes** — standard in research simulations, but real preferences are lumpy and reference-dependent.
- **Keyword-triggered `hidden_info` is a valid proxy for diagnostic questioning / active listening** — our most gameable mechanic; watch for keyword-fishing in transcripts.
- **Deterministic personality knobs (`opening_demand`, `concession_rate`, `patience`) + LLM verbalization feel like a real counterpart** — believability is testable with user studies; skill transfer is not guaranteed by believability.
- **[L]-labeled transcript features mapped through deterministic rubrics = valid, fair skill measurement** — label noise and prompt drift are real; audit labels against human coding samples.
- **Turn-limited, structured-offer play preserves enough of live negotiation for skills to transfer** — the Duolingo bet itself; the literature on sim-to-life transfer in negotiation training is thin. Design for eventual validation (self-reported real-world outcomes, pre/post assessments).
- **Per-game scores are noisy; cross-game ratings are the real signal** — the Chess.com bet; requires enough scenarios and variation that ratings measure skill, not scenario memorization.

*Working document — update tiers as we verify the remaining "(verify)" citations and as our own gameplay data starts confirming or killing tier-3 bets.*
