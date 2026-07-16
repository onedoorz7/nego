import { describe, expect, it } from "vitest";
import { getPath, listLessons, listScenarios } from "@/lib/content/loader";
import { zopaExists } from "@/lib/engine/analysis";

/** Content validation — every shipped JSON file must be playable and sane. */

describe("content files", () => {
  it("all scenarios parse against the schema (loader throws otherwise)", () => {
    const scenarios = listScenarios();
    expect(scenarios.length).toBeGreaterThanOrEqual(3);
  });

  it("all lessons parse and the path references existing lessons", () => {
    const lessons = listLessons();
    expect(lessons.length).toBeGreaterThanOrEqual(10);
    const ids = new Set(lessons.map((l) => l.id));
    for (const id of getPath().lessons) {
      expect(ids.has(id), `path references missing lesson ${id}`).toBe(true);
    }
  });

  it("lesson scenario links point at real scenarios; quiz answers in range", () => {
    const scenarioIds = new Set(listScenarios().map((s) => s.id));
    for (const l of listLessons()) {
      if (l.scenario_id) {
        expect(scenarioIds.has(l.scenario_id), `${l.id} links missing scenario`).toBe(true);
      }
      for (const q of l.quiz) {
        expect(q.answer_index).toBeGreaterThanOrEqual(0);
        expect(q.answer_index).toBeLessThan(q.choices.length);
      }
    }
  });

  it("every scenario is coherent (ZOPA, targets, coverage, prep links)", () => {
    for (const s of listScenarios()) {
      // A real zone of agreement must exist with authored reservations.
      expect(
        zopaExists(s, s.player_role.reservation_utility, s.ai_role.reservation_utility),
        `${s.id}: no ZOPA`
      ).toBe(true);

      // Targets above reservations for both sides.
      expect(s.player_role.target_utility).toBeGreaterThan(s.player_role.reservation_utility);
      expect(s.ai_role.target_utility).toBeGreaterThan(s.ai_role.reservation_utility);

      // primary_field exists.
      expect(
        s.offer_fields.some((f) => f.key === s.primary_field),
        `${s.id}: primary_field missing`
      ).toBe(true);

      // Both roles weight every field, and select option_values cover options.
      for (const f of s.offer_fields) {
        for (const [roleName, prefs] of [
          ["player", s.player_role.preferences],
          ["ai", s.ai_role.preferences],
        ] as const) {
          const pref = prefs[f.key];
          expect(pref, `${s.id}: ${roleName} missing pref for ${f.key}`).toBeDefined();
          if (f.type === "select") {
            for (const o of f.options) {
              expect(
                pref!.option_values?.[o.value],
                `${s.id}: ${roleName} option_values missing "${o.value}" for ${f.key}`
              ).toBeDefined();
            }
          }
        }
      }

      // Number prep fields refer to real number offer fields.
      for (const p of s.preparation) {
        if (p.kind === "number" && p.refers_to) {
          expect(
            s.offer_fields.some((f) => f.key === p.refers_to && f.type === "number"),
            `${s.id}: prep ${p.id} refers_to missing field`
          ).toBe(true);
        }
      }

      // Events fire within the turn limit.
      for (const e of s.events) {
        expect(e.turn).toBeLessThanOrEqual(s.turn_limit);
      }
    }
  });
});
