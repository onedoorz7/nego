/**
 * Runtime types shared across engines (session state, offers, evaluation).
 * Content-file types live in src/lib/content/schema.ts.
 */

export type Side = "player" | "ai";

/** A structured offer: values keyed by offer-field key. */
export type OfferValues = Record<string, number | string>;

export interface StandingOffer {
  by: Side;
  values: OfferValues;
  turn: number;
}

export type TranscriptKind =
  | "message" // spoken line (player probe question or AI dialogue)
  | "move" // non-verbal player move (flinch, silence)
  | "offer" // structured offer proposed (offer attached)
  | "accept" // acceptance of the standing offer
  | "reject" // explicit rejection without counter
  | "walk" // walk-away
  | "event" // scenario event fired (system)
  | "info"; // system notice

export interface TranscriptEntry {
  turn: number;
  speaker: Side | "system";
  kind: TranscriptKind;
  text: string;
  offer?: OfferValues;
  /** Hidden-info ids revealed in this AI message, if any. */
  revealed?: string[];
  at: string; // ISO timestamp
}

export type SessionStatus =
  | "preparing" // prep form not yet submitted
  | "active"
  | "agreement"
  | "player_walked"
  | "ai_walked"
  | "turn_limit"
  | "abandoned";

export type GamePhase = "explore" | "bargain" | "close" | "done";

/** Parameters resolved from scenario.variation at session start (seeded). */
export interface ResolvedParams {
  ai_reservation_utility: number;
  ai_target_utility: number;
  opening_demand: number;
  turn_limit: number;
}

export interface AiInternalState {
  offers_made: number;
  /** Turns the AI has spent below-reservation-annoyed; drives walk-away. */
  frustration: number;
  warned_walk: boolean;
  /** Cumulative threshold shift from fired events and player pressure moves. */
  event_threshold_delta: number;
  mood: "warm" | "neutral" | "wary" | "annoyed";
  /** Flinches the player has used (only the first 2 move the needle). */
  flinches_used: number;
  /** Consecutive silence moves — the AI stops falling for it. */
  silence_streak: number;
  /** Player declared their standing offer final ("take it or leave it"). */
  final_declared: boolean;
  /** Player made another offer AFTER declaring final — bluff caught. */
  credibility_broken: boolean;
}

export interface SessionState {
  id: string;
  scenario_id: string;
  seed: number;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
  /** Player-turn counter (a turn = one player action + the AI's response). */
  turn: number;
  resolved: ResolvedParams;
  prep: Record<string, string | number> | null;
  transcript: TranscriptEntry[];
  standing_offer: StandingOffer | null;
  /** All offers ever made, in order. */
  offer_history: StandingOffer[];
  revealed_info: string[];
  events_fired: string[];
  ai: AiInternalState;
  outcome: Outcome | null;
}

export interface Outcome {
  type: Exclude<SessionStatus, "preparing" | "active">;
  final_offer: OfferValues | null;
  player_utility: number | null;
  ai_utility: number | null;
}

// ---------------------------------------------------------------------------
// Opponent policy decisions (deterministic — computed before any LLM call)
// ---------------------------------------------------------------------------

export type AiIntent =
  | "accept"
  | "counter_offer"
  | "first_offer"
  | "reject_offer"
  | "answer" // respond to a question/move without an offer
  | "hold_firm" // brush off pressure (flinch) without changing terms
  | "nudge" // ask the player to get concrete
  | "warn_walk"
  | "walk_away";

export interface PolicyDecision {
  intent: AiIntent;
  offer: OfferValues | null;
  /** Hidden-info ids the dialogue layer MAY weave in this turn. */
  allowed_reveals: string[];
  /** Threshold the decision was made against (for logging/eval). */
  acceptance_threshold: number;
  /** Utility of the player's standing offer to the AI, if one exists. */
  standing_offer_utility: number | null;
  mood: AiInternalState["mood"];
  phase: GamePhase;
  /** Notes for the dialogue prompt (event context, guardrails). */
  notes: string[];
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export type ScoreBasis = "objective" | "rule_based";

export interface ScoreItem {
  key: string;
  label: string;
  value: number; // 0-100
  basis: ScoreBasis;
  explanation: string;
}

export interface Observation {
  rule: string;
  kind: "strength" | "opportunity";
  text: string;
}

export interface DealAnalysis {
  deal_reached: boolean;
  final_offer: OfferValues | null;
  player_utility: number | null;
  ai_utility: number | null;
  joint_utility: number | null;
  max_joint_utility: number;
  /** A feasible offer that would have been ≥ for both sides (if deal reached
   * and one exists) — "a better package was available". */
  pareto_improvement: OfferValues | null;
  zopa_existed: boolean;
  player_vs_reservation: number | null; // player_utility - reservation
  player_vs_target: number | null;
  player_vs_batna: number | null;
  walk_was_reasonable: boolean | null; // only set when player walked
}

export interface EvaluationResult {
  analysis: DealAnalysis;
  scores: ScoreItem[];
  total: number; // weighted 0-100
  xp: number;
  observations: Observation[];
  discovery: { revealed: string[]; missed: string[] };
  /** Player-facing game score (present when the scenario defines arcade). */
  arcade: {
    points: number;
    breakdown: { label: string; points: number; detail: string }[];
    best_possible: number;
  } | null;
}

/** LLM-generated debrief — clearly labeled subjective coaching. */
export interface Coaching {
  what_happened: string;
  strengths: string[];
  missed_opportunities: string[];
  example_lines: string[]; // 1-2 lines the player could have used
  concept_to_review: string;
  generated_by: "llm" | "template";
}
