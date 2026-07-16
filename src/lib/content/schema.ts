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

export const ScenarioSchema = z.object({
  id: z.string(),
  title: z.string(),
  emoji: z.string().default("🤝"),
  difficulty: z.number().int().min(1).max(5),
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
