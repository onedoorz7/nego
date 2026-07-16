import type { Scenario } from "@/lib/content/schema";

/**
 * Deterministic player-message classification.
 * Keyword/heuristic based on purpose: cheap, testable, and no LLM in the loop
 * for anything that feeds scoring or information-reveal gating.
 */

export interface MessageAnalysis {
  is_question: boolean;
  /** Hidden-info ids whose reveal_topics match this message. */
  matched_info_ids: string[];
  /** Distinct reveal topics touched (for topic-coverage scoring). */
  matched_topics: string[];
}

export function analyzePlayerMessage(
  scenario: Scenario,
  text: string
): MessageAnalysis {
  const lower = text.toLowerCase();
  const isQuestion =
    /\?/.test(text) ||
    /^(why|how|what|when|where|who|do you|did you|are you|is it|can you|could you|would you|tell me)\b/.test(
      lower.trim()
    );

  const matchedIds: string[] = [];
  const matchedTopics: string[] = [];
  for (const info of scenario.ai_role.hidden_info) {
    const hits = info.reveal_topics.filter((t) => lower.includes(t));
    if (hits.length > 0) {
      matchedIds.push(info.id);
      matchedTopics.push(...hits);
    }
  }
  return {
    is_question: isQuestion,
    matched_info_ids: matchedIds,
    matched_topics: [...new Set(matchedTopics)],
  };
}
