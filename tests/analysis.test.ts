import { describe, expect, it } from "vitest";
import { getScenario, listScenarios } from "@/lib/content/loader";
import {
  bestOfferAtAiLevel,
  maxJointUtility,
  paretoFrontier,
  paretoImprovement,
  zopaExists,
} from "@/lib/engine/analysis";
import { utilityFor } from "@/lib/engine/utility";

describe("offer-space analysis", () => {
  it("max joint utility dominates random sampled offers", () => {
    const s = getScenario("used-camera-001");
    const maxJoint = maxJointUtility(s);
    for (let price = 300; price <= 600; price += 25) {
      for (const extras of ["none", "battery_bag", "full_kit"]) {
        const joint =
          utilityFor(s, "player", { price, extras }) +
          utilityFor(s, "ai", { price, extras });
        expect(joint).toBeLessThanOrEqual(maxJoint + 0.001);
      }
    }
  });

  it("frontier points are mutually non-dominated", () => {
    const pts = paretoFrontier(getScenario("used-camera-001"));
    for (const a of pts) {
      for (const b of pts) {
        if (a === b) continue;
        const dominates =
          a.player >= b.player + 0.01 && a.ai >= b.ai + 0.01;
        expect(dominates).toBe(false);
      }
    }
  });

  it("bestOfferAtAiLevel meets the level and is null when unreachable", () => {
    const s = getScenario("used-camera-001");
    const p = bestOfferAtAiLevel(s, 50);
    expect(p).not.toBeNull();
    expect(p!.ai).toBeGreaterThanOrEqual(50);
    expect(bestOfferAtAiLevel(s, 1000)).toBeNull();
  });

  it("ZOPA exists for all shipped scenarios with authored reservations", () => {
    for (const s of listScenarios()) {
      expect(
        zopaExists(s, s.player_role.reservation_utility, s.ai_role.reservation_utility),
        `no ZOPA in ${s.id}`
      ).toBe(true);
    }
  });

  it("detects a pareto improvement for an inefficient deal", () => {
    const s = getScenario("used-camera-001");
    // $470 with no extras: buyer pays a lot AND gets nothing extra — the
    // integrative trade (extras are cheap for seller) is left on the table.
    const better = paretoImprovement(s, { price: 470, extras: "none" });
    expect(better).not.toBeNull();
  });
});
