import type { Scenario } from "@/lib/content/schema";
import type {
  DealAnalysis,
  EvaluationResult,
  Observation,
  ScoreItem,
  SessionState,
} from "@/lib/types";
import { maxJointUtility, paretoImprovement, zopaExists } from "./analysis";
import { bestPossiblePoints, computeArcadePoints } from "./arcade";
import { analyzePlayerMessage } from "./classify";
import { utilityFor } from "./utility";

/**
 * Evaluation engine — every number here is deterministic. Scores are labeled
 * "objective" (pure math on the utility model) or "rule_based" (transparent
 * heuristics on behavior). The LLM contributes zero numbers.
 * Formulas documented in docs/scoring-framework.md.
 */

const WEIGHTS: Record<string, number> = {
  personal: 0.3,
  joint: 0.2,
  discovery: 0.15,
  concessions: 0.15,
  preparation: 0.1,
  process: 0.1,
};

const clamp = (x: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, x));
const round1 = (x: number) => Math.round(x * 10) / 10;

export function evaluateSession(
  scenario: Scenario,
  state: SessionState
): EvaluationResult {
  const analysis = analyzeDeal(scenario, state);
  const observations: Observation[] = [];

  // Preparation is optional (arcade flow skips it) — when skipped, the
  // category is dropped and remaining weights renormalized, not zero-scored.
  const prepSkipped =
    !state.prep || Object.keys(state.prep).length === 0;

  const scores: ScoreItem[] = [
    personalScore(scenario, state, analysis, observations),
    jointScore(scenario, analysis, observations),
    discoveryScore(scenario, state, observations),
    concessionScore(scenario, state, observations),
    ...(prepSkipped ? [] : [preparationScore(scenario, state, observations)]),
    processScore(scenario, state, observations),
  ];

  const weightSum = scores.reduce((s, i) => s + (WEIGHTS[i.key] ?? 0), 0);
  const total = round1(
    scores.reduce(
      (s, item) => s + item.value * ((WEIGHTS[item.key] ?? 0) / (weightSum || 1)),
      0
    )
  );

  const revealed = state.revealed_info;
  const missed = scenario.ai_role.hidden_info
    .map((h) => h.id)
    .filter((id) => !revealed.includes(id));

  const xp = computeXp(total, scenario.difficulty, analysis.deal_reached);

  const arcadeScore = scenario.arcade
    ? {
        ...computeArcadePoints(scenario, analysis.final_offer),
        best_possible: bestPossiblePoints(
          scenario,
          state.resolved.ai_reservation_utility
        ),
      }
    : null;

  return {
    analysis,
    scores,
    total,
    xp,
    observations,
    discovery: { revealed, missed },
    arcade: arcadeScore,
  };
}

// ---------------------------------------------------------------------------

function analyzeDeal(scenario: Scenario, state: SessionState): DealAnalysis {
  const deal = state.outcome?.type === "agreement" ? state.outcome.final_offer : null;
  const pr = scenario.player_role.reservation_utility;
  const ar = state.resolved.ai_reservation_utility;
  const maxJoint = round1(maxJointUtility(scenario));

  const pu = deal ? round1(utilityFor(scenario, "player", deal)) : null;
  const au = deal ? round1(utilityFor(scenario, "ai", deal)) : null;

  // Was walking reasonable? Only meaningful when the player walked (or time
  // ran out): disciplined iff the best offer the AI actually made was below
  // the player's reservation.
  let walkReasonable: boolean | null = null;
  if (state.outcome && state.outcome.type !== "agreement") {
    const aiOffers = state.offer_history.filter((o) => o.by === "ai");
    const bestAiOffer = aiOffers.reduce(
      (best, o) => Math.max(best, utilityFor(scenario, "player", o.values)),
      -Infinity
    );
    walkReasonable = aiOffers.length === 0 ? false : bestAiOffer < pr;
    if (state.outcome.type === "ai_walked") walkReasonable = null;
  }

  return {
    deal_reached: !!deal,
    final_offer: deal,
    player_utility: pu,
    ai_utility: au,
    joint_utility: pu !== null && au !== null ? round1(pu + au) : null,
    max_joint_utility: maxJoint,
    pareto_improvement: deal ? (paretoImprovement(scenario, deal)?.offer ?? null) : null,
    zopa_existed: zopaExists(scenario, pr, state.resolved.ai_reservation_utility),
    player_vs_reservation: pu !== null ? round1(pu - pr) : null,
    player_vs_target: pu !== null ? round1(pu - scenario.player_role.target_utility) : null,
    player_vs_batna: pu !== null ? round1(pu - scenario.player_role.batna.utility) : null,
    walk_was_reasonable: walkReasonable,
  };
}

function personalScore(
  scenario: Scenario,
  state: SessionState,
  a: DealAnalysis,
  obs: Observation[]
): ScoreItem {
  const r = scenario.player_role.reservation_utility;
  const t = scenario.player_role.target_utility;
  let value: number;
  let explanation: string;

  if (a.deal_reached && a.player_utility !== null) {
    if (a.player_utility >= r) {
      value = clamp(40 + 60 * ((a.player_utility - r) / Math.max(1, t - r)));
      explanation = `Deal utility ${a.player_utility} vs reservation ${r} and target ${t}.`;
      if (a.player_utility >= t) {
        obs.push({
          rule: "hit_target",
          kind: "strength",
          text: "You reached or beat your target — an outcome most negotiators never ask for.",
        });
      }
    } else {
      value = clamp(40 * (a.player_utility / Math.max(1, r)));
      explanation = `You accepted a deal BELOW your reservation point (${a.player_utility} vs ${r}) — your alternative was better.`;
      obs.push({
        rule: "below_reservation",
        kind: "opportunity",
        text: "You accepted less than your walk-away point. Your BATNA was worth more than this deal.",
      });
    }
  } else {
    const type = state.outcome?.type;
    if (type === "player_walked") {
      if (a.walk_was_reasonable) {
        value = 75;
        explanation =
          "No deal, but walking was disciplined: nothing on the table beat your reservation point.";
        obs.push({
          rule: "disciplined_walk",
          kind: "strength",
          text: "You walked away rather than accept a below-reservation deal. That's exactly what a reservation point is for.",
        });
      } else {
        value = 30;
        explanation = a.zopa_existed
          ? "You walked away although an acceptable deal was available (a ZOPA existed)."
          : "You walked away — no acceptable zone existed, but exploration was incomplete.";
        if (a.zopa_existed) {
          obs.push({
            rule: "premature_walk",
            kind: "opportunity",
            text: "A zone of agreement existed — walking away left value on the table.",
          });
        }
      }
    } else if (type === "ai_walked") {
      value = 20;
      explanation = "The other side walked away — the relationship broke down before a deal.";
      obs.push({
        rule: "counterpart_walked",
        kind: "opportunity",
        text: "Pushing past the other side's limits ended the negotiation. Watch for their signals (tone shifts, warnings).",
      });
    } else {
      value = 25;
      explanation = "Time ran out without a deal or a deliberate walk-away.";
      obs.push({
        rule: "clock_ran_out",
        kind: "opportunity",
        text: "The negotiation timed out. Drive toward concrete offers earlier.",
      });
    }
  }
  return {
    key: "personal",
    label: "Personal outcome",
    value: round1(value),
    basis: "objective",
    explanation,
  };
}

function jointScore(
  scenario: Scenario,
  a: DealAnalysis,
  obs: Observation[]
): ScoreItem {
  if (!a.deal_reached || a.joint_utility === null) {
    return {
      key: "joint",
      label: "Joint value",
      value: 0,
      basis: "objective",
      explanation: "No deal — no joint value created.",
    };
  }
  const floor =
    scenario.player_role.reservation_utility +
    scenario.ai_role.reservation_utility;
  const value = clamp(
    (100 * (a.joint_utility - floor)) / Math.max(1, a.max_joint_utility - floor)
  );
  if (a.pareto_improvement) {
    obs.push({
      rule: "pareto_left_on_table",
      kind: "opportunity",
      text: "A package existed that was better for BOTH sides — look for trades where you value things differently.",
    });
  } else {
    obs.push({
      rule: "efficient_deal",
      kind: "strength",
      text: "Your final deal was (near-)efficient — no package was meaningfully better for both sides.",
    });
  }
  return {
    key: "joint",
    label: "Joint value",
    value: round1(value),
    basis: "objective",
    explanation: `Combined utility ${a.joint_utility} vs best possible ${a.max_joint_utility}.`,
  };
}

function discoveryScore(
  scenario: Scenario,
  state: SessionState,
  obs: Observation[]
): ScoreItem {
  const infos = scenario.ai_role.hidden_info;
  if (infos.length === 0) {
    return {
      key: "discovery",
      label: "Information discovery",
      value: 100,
      basis: "objective",
      explanation: "This scenario had no hidden information.",
    };
  }
  const totalWeight = infos.reduce((s, h) => s + h.importance, 0);
  const revealedWeight = infos
    .filter((h) => state.revealed_info.includes(h.id))
    .reduce((s, h) => s + h.importance, 0);
  const value = clamp((100 * revealedWeight) / totalWeight);
  if (value >= 70) {
    obs.push({
      rule: "strong_discovery",
      kind: "strength",
      text: "You uncovered most of what the other side was hiding — questions are leverage.",
    });
  } else if (value <= 35) {
    obs.push({
      rule: "weak_discovery",
      kind: "opportunity",
      text: "Most of the other side's situation stayed hidden. Ask why they're negotiating, what matters to them, and what else they could include.",
    });
  }
  return {
    key: "discovery",
    label: "Information discovery",
    value: round1(value),
    basis: "objective",
    explanation: `Uncovered ${state.revealed_info.length}/${infos.length} hidden facts (importance-weighted ${round1(value)}%).`,
  };
}

function concessionScore(
  scenario: Scenario,
  state: SessionState,
  obs: Observation[]
): ScoreItem {
  const playerOffers = state.offer_history.filter((o) => o.by === "player");
  const notes: string[] = [];
  let value = 100;

  if (playerOffers.length === 0) {
    return {
      key: "concessions",
      label: "Concession discipline",
      value: state.outcome?.type === "agreement" ? 55 : 40,
      basis: "rule_based",
      explanation: "You never made a structured offer of your own — the other side controlled the numbers.",
    };
  }

  // Ambition of the first offer relative to target.
  const first = utilityFor(scenario, "player", playerOffers[0].values);
  if (first < scenario.player_role.target_utility) {
    value -= 15;
    notes.push("opened below your own target");
    obs.push({
      rule: "timid_opening",
      kind: "opportunity",
      text: "Your first offer was less ambitious than your own target — you negotiated against yourself before the other side said a word.",
    });
  } else {
    obs.push({
      rule: "ambitious_opening",
      kind: "strength",
      text: "Your opening offer was at least as ambitious as your target. Strong anchor.",
    });
  }

  // Bidding against yourself: consecutive player offers with no AI offer between.
  let selfBids = 0;
  for (let i = 1; i < state.offer_history.length; i++) {
    const cur = state.offer_history[i];
    const prevO = state.offer_history[i - 1];
    if (cur.by === "player" && prevO.by === "player") {
      const before = utilityFor(scenario, "player", prevO.values);
      const after = utilityFor(scenario, "player", cur.values);
      if (after < before - 0.5) selfBids += 1;
    }
  }
  if (selfBids > 0) {
    value -= 25 * selfBids;
    notes.push(`conceded ${selfBids}× without a counter-offer in between`);
    obs.push({
      rule: "bid_against_self",
      kind: "opportunity",
      text: "You improved your offer without getting a counter first — never bid against yourself.",
    });
  }

  // Concession sizes should shrink (signals a limit approaching).
  const puSeq = playerOffers.map((o) => utilityFor(scenario, "player", o.values));
  let growingConcessions = 0;
  for (let i = 2; i < puSeq.length; i++) {
    const c1 = puSeq[i - 2] - puSeq[i - 1];
    const c2 = puSeq[i - 1] - puSeq[i];
    if (c2 > c1 + 1 && c2 > 0) growingConcessions += 1;
  }
  if (growingConcessions > 0) {
    value -= 10 * growingConcessions;
    notes.push("concessions grew instead of shrinking");
    obs.push({
      rule: "growing_concessions",
      kind: "opportunity",
      text: "Your concessions got bigger over time — shrinking steps signal you're near your limit; growing steps invite more pushing.",
    });
  } else if (puSeq.length >= 3) {
    obs.push({
      rule: "shrinking_concessions",
      kind: "strength",
      text: "Your concessions shrank over time — a credible signal that you were approaching your limit.",
    });
  }

  return {
    key: "concessions",
    label: "Concession discipline",
    value: round1(clamp(value)),
    basis: "rule_based",
    explanation: notes.length ? `Penalties: ${notes.join("; ")}.` : "Clean concession pattern.",
  };
}

function preparationScore(
  scenario: Scenario,
  state: SessionState,
  obs: Observation[]
): ScoreItem {
  const prep = state.prep ?? {};
  const fields = scenario.preparation;
  let value = 0;
  const notes: string[] = [];

  // 50%: completeness.
  const filled = fields.filter((f) => {
    const v = prep[f.id];
    return v !== undefined && v !== null && String(v).trim() !== "";
  });
  value += 50 * (filled.length / Math.max(1, fields.length));
  if (filled.length < fields.length) notes.push(`${fields.length - filled.length} prep fields left blank`);

  // 30%: numeric plan coherence on the primary field.
  const primary = scenario.offer_fields.find((f) => f.key === scenario.primary_field);
  const reservation = Number(prep["reservation"]);
  const target = Number(prep["target"]);
  const opening = Number(prep["opening"]);
  if (primary?.type === "number" && [reservation, target, opening].every(Number.isFinite)) {
    const pref = scenario.player_role.preferences[primary.key];
    const higherBetter = (pref?.best ?? primary.max) >= (pref?.worst ?? primary.min);
    const ok = higherBetter
      ? target >= reservation && opening >= target
      : target <= reservation && opening <= target;
    const inBounds = [reservation, target, opening].every(
      (v) => v >= primary.min && v <= primary.max
    );
    if (ok && inBounds) {
      value += 30;
      obs.push({
        rule: "coherent_plan",
        kind: "strength",
        text: "Your plan was internally consistent: opening ≥ target ≥ walk-away (in the right direction).",
      });
    } else {
      notes.push("plan numbers inconsistent (opening/target/walk-away out of order or out of range)");
      obs.push({
        rule: "incoherent_plan",
        kind: "opportunity",
        text: "Your planned opening, target, and walk-away weren't in a coherent order — decide these three numbers before you start.",
      });
    }

    // 20%: did the first real offer match the plan?
    const firstOffer = state.offer_history.find((o) => o.by === "player");
    if (firstOffer && Number.isFinite(opening)) {
      const actual = Number(firstOffer.values[primary.key]);
      const span = primary.max - primary.min;
      if (Math.abs(actual - opening) <= span * 0.05) {
        value += 20;
        obs.push({
          rule: "followed_plan",
          kind: "strength",
          text: "Your actual opening matched your planned opening — plans only work if you follow them.",
        });
      } else {
        notes.push(`planned to open at ${opening} but opened at ${actual}`);
      }
    }
  }

  return {
    key: "preparation",
    label: "Preparation quality",
    value: round1(clamp(value)),
    basis: "rule_based",
    explanation: notes.length ? notes.join("; ") : "Complete, coherent, and followed.",
  };
}

function processScore(
  scenario: Scenario,
  state: SessionState,
  obs: Observation[]
): ScoreItem {
  const firstPlayerOfferTurn =
    state.offer_history.find((o) => o.by === "player")?.turn ?? Infinity;

  let questionsBeforeOffer = 0;
  const topics = new Set<string>();
  for (const e of state.transcript) {
    if (e.speaker !== "player" || e.kind !== "message") continue;
    const a = analyzePlayerMessage(scenario, e.text);
    if (a.is_question && e.turn < firstPlayerOfferTurn) questionsBeforeOffer += 1;
    a.matched_info_ids.forEach((t) => topics.add(t));
  }

  const infoCount = Math.max(1, scenario.ai_role.hidden_info.length);
  const value = clamp(
    70 * Math.min(1, questionsBeforeOffer / 3) + 30 * (topics.size / infoCount)
  );

  if (questionsBeforeOffer === 0) {
    obs.push({
      rule: "no_questions_first",
      kind: "opportunity",
      text: "You went straight to numbers without asking questions first. Diagnose before you prescribe.",
    });
  } else if (questionsBeforeOffer >= 3) {
    obs.push({
      rule: "diagnosed_first",
      kind: "strength",
      text: "You asked several questions before talking numbers — that's where deals get better.",
    });
  }

  return {
    key: "process",
    label: "Questions & process",
    value: round1(value),
    basis: "rule_based",
    explanation: `${questionsBeforeOffer} question(s) before your first offer; probed ${topics.size}/${infoCount} hidden areas.`,
  };
}

function computeXp(total: number, difficulty: number, dealReached: boolean): number {
  return Math.round(total / 2) + difficulty * 20 + (dealReached ? 10 : 0);
}
