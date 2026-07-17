import { describe, expect, it } from "vitest";
import { getScenario, listScenarios } from "@/lib/content/loader";
import {
  aiFloorOnPrimary,
  bestPossiblePoints,
  computeArcadePoints,
} from "@/lib/engine/arcade";

const camera = () => getScenario("used-camera-001");

describe("arcade scoring", () => {
  it("scores 'every dollar saved is a point' plus extras bonuses", () => {
    const s = camera();
    const r = computeArcadePoints(s, { price: 430, extras: "battery_bag" });
    // $90 under the $520 listing + 60 for battery & bag
    expect(r.points).toBe(150);
    expect(r.breakdown.map((b) => b.points)).toEqual([90, 60]);
  });

  it("overpaying eats into bonuses; the round total never goes negative", () => {
    // $560 with nothing extra: plain bad deal → 0.
    expect(computeArcadePoints(camera(), { price: 560, extras: "none" }).points).toBe(0);
    // $540 with the full kit: 85 bonus − 20 overpay = 65 (not a free 85).
    const r = computeArcadePoints(camera(), { price: 540, extras: "full_kit" });
    expect(r.points).toBe(65);
    expect(r.breakdown.find((b) => b.label.includes("listing"))!.points).toBe(-20);
  });

  it("no deal = 0 points", () => {
    expect(computeArcadePoints(camera(), null).points).toBe(0);
  });

  it("best possible beats a mediocre deal and respects the AI's floor", () => {
    const s = camera();
    const reservation = s.ai_role.reservation_utility;
    const best = bestPossiblePoints(s, reservation);
    const mediocre = computeArcadePoints(s, { price: 480, extras: "none" }).points;
    expect(best).toBeGreaterThan(mediocre);
    // Sanity ceiling: can't out-score buying at the field minimum with full kit.
    const absurd = computeArcadePoints(s, { price: 300, extras: "full_kit" }).points;
    expect(best).toBeLessThanOrEqual(absurd);
  });

  it("reveals a plausible floor on the primary field after a loss", () => {
    const s = camera();
    const floor = aiFloorOnPrimary(s, s.ai_role.reservation_utility);
    expect(typeof floor).toBe("number");
    // Seller's floor should be under the listing but above the field minimum.
    expect(Number(floor)).toBeGreaterThan(300);
    expect(Number(floor)).toBeLessThan(520);
  });

  it("every shipped scenario has a coherent arcade block", () => {
    for (const s of listScenarios()) {
      expect(s.arcade, `${s.id} missing arcade block`).toBeDefined();
      for (const entry of s.arcade!.points) {
        const field = s.offer_fields.find((f) => f.key === entry.field);
        expect(field, `${s.id}: arcade points reference missing field ${entry.field}`).toBeDefined();
        if (entry.kind === "values") {
          expect(field!.type).toBe("select");
          if (field!.type === "select") {
            for (const o of field!.options) {
              expect(
                entry.values[o.value],
                `${s.id}: arcade values missing option "${o.value}" on ${entry.field}`
              ).toBeDefined();
            }
          }
        } else {
          expect(field!.type).toBe("number");
        }
      }
      // A deal at the AI's reservation must be worth something to chase.
      expect(
        bestPossiblePoints(s, s.ai_role.reservation_utility),
        `${s.id}: best possible arcade score is 0`
      ).toBeGreaterThan(50);
    }
  });
});
