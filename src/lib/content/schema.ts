import { z } from "zod";

/**
 * Content schemas — the single source of truth for scenario and lesson files.
 *
 * Design notes (see docs/scenario-design.md):
 * - Scenarios are deterministic game definitions. The LLM never owns facts,
 *   constraints, offers, or scores — it only verbalizes decisions made by the
 *   deterministic opponent policy engine.
 * - Utilities are on a 0–100 scale per role. Each role's utility for an offer
 *   is the weighted sum of per-field normalized values (0..1) × 100.
 * - `variation` lets replays differ: ranged parameters are sampled with a
 *   seeded RNG at session start, so the same scenario file yields many games.
 * - `hidden_info` items surface only when the player asks about matching
 *   topics — the "unknown elements become known as you play" mechanic.
 * - `events` are scripted mid-game surprises that fire at a given turn and can
 *   shift the AI's acceptance threshold (pressure up or down).
 */

// ---------------------------------------------------------------------------
// Offer fields
// ---------------------------------------------------------------------------

export const NumberFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.literal("number"),
  unit: z.string().optional(), // "$", "days", "revisions"
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
});

export const SelectFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.literal("select"),
  options: z
    .array(z.object({ value: z.string(), label: z.string() }))
    .min(2),
});

export const OfferFieldSchema = z.discriminatedUnion("type", [
  NumberFieldSchema,
  SelectFieldSchema,
]);
export type OfferField = z.infer<typeof OfferFieldSchema>;

// ---------------------------------------------------------------------------
// Preferences → utility
// ---------------------------------------------------------------------------

/** How much a role cares about a field and which direction is better.
 * For number fields: normalized = (value - worst) / (best - worst), clamped 0..1.
 * For select fields: option_values maps option value → 0..1.
 * Weights are normalized across fields at load time (they need not sum to 1). */
export const PreferenceSchema = z.object({
  weight: z.number().positive(),
  // number fields:
  best: z.number().optional(),
  worst: z.number().optional(),
  // select fields:
  option_values: z.record(z.string(), z.number().min(0).max(1)).optional(),
});
export type Preference = z.infer<typeof PreferenceSchema>;

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

const RoleBaseSchema = z.object({
  name: z.string(), // "Buyer", "Freelance designer"
  persona: z.string(), // one-line description of who this side is
  /** Markdown brief shown ONLY to this side. Never sent to the other side. */
  private_brief: z.string(),
  preferences: z.record(z.string(), PreferenceSchema),
  batna: z.object({
    description: z.string(),
    utility: z.number().min(0).max(100),
  }),
  /** Minimum acceptable deal utility. Below this, walking away is rational. */
  reservation_utility: z.number().min(0).max(100),
  /** Realistic-but-ambitious goal utility. */
  target_utility: z.number().min(0).max(100),
});

export const PlayerRoleSchema = RoleBaseSchema;
export type PlayerRole = z.infer<typeof PlayerRoleSchema>;

export const PersonalitySchema = z.object({
  id: z.string(), // "friendly_hobbyist"
  /** Style instructions for the dialogue LLM. Behavior numbers below are what
   * actually governs offers — this string only shapes tone and word choice. */
  style_prompt: z.string(),
  /** 0..1 — how close to its own best corner the AI's first offer is. */
  opening_demand: z.number().min(0).max(1),
  /** 0..1 — per-turn decay of the acceptance threshold from target toward
   * reservation. Higher = concedes faster. */
  concession_rate: z.number().min(0).max(1),
  /** Number of player turns the AI waits before making the first offer itself
   * (if the player hasn't). Patience > turn_limit means it never opens. */
  patience: z.number().int().min(0),
  /** If true the AI warns once before walking away; otherwise it just leaves. */
  warns_before_walking: z.boolean().default(true),
});
export type Personality = z.infer<typeof PersonalitySchema>;

export const HiddenInfoSchema = z.object({
  id: z.string(),
  /** The fact itself, phrased for the AI to weave into dialogue. */
  fact: z.string(),
  /** Player-message keywords/topics that unlock this fact (case-insensitive
   * substring match; keep entries lowercase). */
  reveal_topics: z.array(z.string()).min(1),
  /** 1–3; weighting for the information-discovery score. */
  importance: z.number().int().min(1).max(3),
  /** The Ask-move card for this item: a natural question the player can tap
   * to probe this topic (deterministic unlock — no keyword matching). */
  probe: z.string().optional(),
});
export type HiddenInfo = z.infer<typeof HiddenInfoSchema>;

export const AiRoleSchema = RoleBaseSchema.extend({
  personality: PersonalitySchema,
  hidden_info: z.array(HiddenInfoSchema).default([]),
  /** Facts the AI may share freely when asked (public-ish color). */
  talking_points: z.array(z.string()).default([]),
});
export type AiRole = z.infer<typeof AiRoleSchema>;

// ---------------------------------------------------------------------------
// Mid-game events & variation
// ---------------------------------------------------------------------------

export const ScenarioEventSchema = z.object({
  id: z.string(),
  /** Turn (player-turn count) at which the event fires. */
  turn: z.number().int().min(1),
  /** Shown to the player as a system message. */
  player_note: z.string(),
  /** Injected into the AI's context so dialogue reflects it. */
  ai_note: z.string(),
  /** Shift applied to the AI acceptance threshold from this turn on.
   * Positive = AI gets tougher, negative = AI gets more eager. */
  threshold_delta: z.number().default(0),
});
export type ScenarioEvent = z.infer<typeof ScenarioEventSchema>;

const RangeSchema = z.object({ min: z.number(), max: z.number() });

/** Ranged parameters sampled per session with a seeded RNG → replay variety. */
export const VariationSchema = z.object({
  ai_reservation_utility: RangeSchema.optional(),
  ai_target_utility: RangeSchema.optional(),
  opening_demand: RangeSchema.optional(),
  turn_limit: RangeSchema.optional(),
});
export type Variation = z.infer<typeof VariationSchema>;

// ---------------------------------------------------------------------------
// Arcade scoring — the player-facing game layer
// ---------------------------------------------------------------------------

/** Converts a deal into concrete points ("every $ you save is a point").
 * The utility model still runs underneath for analysis; THIS is the score the
 * player chases. Per-entry points are clamped at ≥ 0; no deal = 0 points. */
export const ArcadePointsEntrySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("per_unit"),
    field: z.string(),
    /** Reference value (e.g. the $520 listing price). */
    baseline: z.number(),
    /** "below": points for beating the baseline downward (buyer);
     * "above": points for beating it upward (seller/candidate). */
    direction: z.enum(["below", "above"]),
    /** Points per unit of improvement over the baseline. */
    per_unit: z.number().positive(),
    label: z.string(),
  }),
  z.object({
    kind: z.literal("values"),
    field: z.string(),
    /** Select-option value → points. */
    values: z.record(z.string(), z.number()),
    label: z.string(),
  }),
]);
export type ArcadePointsEntry = z.infer<typeof ArcadePointsEntrySchema>;

export const ArcadeSchema = z.object({
  /** One-line mission shown on the round card. All the player must read. */
  mission: z.string(),
  /** Even shorter version for the in-game header. */
  short_mission: z.string(),
  /** 2-3 tiny facts pinned in the game header ("Budget: $460"). */
  player_hud: z.array(z.string()).max(4).default([]),
  points: z.array(ArcadePointsEntrySchema).min(1),
});
export type Arcade = z.infer<typeof ArcadeSchema>;

// ---------------------------------------------------------------------------
// Preparation form
// ---------------------------------------------------------------------------

export const PrepFieldSchema = z.object({
  id: z.string(), // "goal" | "batna" | "reservation" | "target" | "opening" | "questions" | "avoid_reveal" | custom
  label: z.string(),
  kind: z.enum(["text", "number"]),
  help: z.string().optional(),
  /** For number fields: which offer field this plan refers to (usually the
   * primary field). Lets the debrief compare plan vs. actual play. */
  refers_to: z.string().optional(),
});
export type PrepField = z.infer<typeof PrepFieldSchema>;

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------

/** Mystery mode: the thing being traded has a hidden true value, sampled per
 * session. Clue probes return tier-dependent hints; the value is revealed only
 * after the deal — points = value − price, and CAN go negative. */
export const MysterySchema = z.object({
  /** The offer field that is the purchase price. */
  value_field: z.string(),
  /** True-value sampling range (uniform, seeded). */
  value_range: z.object({ min: z.number(), max: z.number() }),
  /** Flavor line for the reveal moment, e.g. "You cut the lock…". */
  reveal_text: z.string(),
  /** Tappable clue probes with tier-dependent answers (thirds of the range). */
  clues: z
    .array(
      z.object({
        id: z.string(),
        probe: z.string(),
        low: z.string(),
        mid: z.string(),
        high: z.string(),
      })
    )
    .min(1),
});
export type Mystery = z.infer<typeof MysterySchema>;

export const ScenarioSchema = z.object({
  id: z.string(),
  title: z.string(),
  emoji: z.string().default("🤝"),
  difficulty: z.number().int().min(1).max(5),
  /** Game mode: standard bargaining, real-time blitz, or hidden-value mystery. */
  mode: z.enum(["standard", "blitz", "mystery"]).default("standard"),
  /** Lab scenarios are experimental: always unlocked, shown on the Lab shelf,
   * outside the numbered-round progression. */
  lab: z.boolean().default(false),
  /** Blitz only: wall-clock seconds before the counterpart walks out. */
  blitz_seconds: z.number().int().min(20).max(600).optional(),
  /** Mystery only. */
  mystery: MysterySchema.optional(),
  concepts: z.array(z.string()).min(1),
  /** One-line pitch shown on the scenario card. */
  tagline: z.string(),
  /** Context both sides know. Markdown. */
  public_context: z.string(),
  player_role: PlayerRoleSchema,
  ai_role: AiRoleSchema,
  offer_fields: z.array(OfferFieldSchema).min(1),
  /** The headline field (e.g. "price") used for plan-vs-play comparisons. */
  primary_field: z.string(),
  turn_limit: z.number().int().min(4).max(30).default(12),
  /** Player-facing points config. Required for playable rounds (the loader
   * tolerates its absence only for founder drafts). */
  arcade: ArcadeSchema.optional(),
  preparation: z.array(PrepFieldSchema).min(1),
  events: z.array(ScenarioEventSchema).default([]),
  variation: VariationSchema.default({}),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

// ---------------------------------------------------------------------------
// Lessons & learning path
// ---------------------------------------------------------------------------

export const QuizItemSchema = z.object({
  question: z.string(),
  choices: z.array(z.string()).min(2).max(5),
  answer_index: z.number().int().min(0),
  explanation: z.string(),
});
export type QuizItem = z.infer<typeof QuizItemSchema>;

export const LessonSchema = z.object({
  id: z.string(),
  order: z.number().int().min(1),
  concept: z.string(), // machine key, e.g. "batna"
  title: z.string(),
  emoji: z.string().default("📘"),
  /** Short explanation. Markdown. Aim for < 300 words. */
  summary: z.string(),
  /** Practical worked example. Markdown. */
  example: z.string(),
  common_mistake: z.string(),
  /** Reflective question shown before the linked scenario's prep screen. */
  prep_question: z.string(),
  quiz: z.array(QuizItemSchema).min(1).max(4),
  /** Scenario to practice this concept in, if any. */
  scenario_id: z.string().nullable(),
});
export type Lesson = z.infer<typeof LessonSchema>;

export const PathSchema = z.object({
  /** Ordered lesson ids. A step unlocks when the previous step's lesson quiz
   * is passed (and its scenario, if any, has been attempted at least once). */
  lessons: z.array(z.string()).min(1),
});
export type LearningPath = z.infer<typeof PathSchema>;
