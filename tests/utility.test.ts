import { describe, expect, it } from "vitest";
import { getScenario } from "@/lib/content/loader";
import {
  fieldValue,
  normalizedWeights,
  utilityFor,
} from "@/lib/engine/utility";

const camera = () => getScenario("used-camera-001");

describe("utility model", () => {
  it("normalizes weights to sum 1", () => {
    const w = normalizedWeights(camera().player_role.preferences);
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it("computes hand-verified buyer utility ($430 + battery_bag ≈ 69)", () => {
    // buyer: price w=.85 best=380 worst=550 → (550-430)/170 = 0.7059
    // extras w=.15, battery_bag = 0.6
    // u = .85*70.59 + .15*60 = 60.0 + 9.0 = 69.0
    const u = utilityFor(camera(), "player", { price: 430, extras: "battery_bag" });
    expect(u).toBeCloseTo(69.0, 1);
  });

  it("computes hand-verified seller utility ($500, no extras ≈ 73.5)", () => {
    // seller: price w=.9 best=550 worst=380 → (500-380)/170 = 0.7059
    // extras w=.1, none = 1
    // u = .9*70.59 + .1*100 = 63.5 + 10 = 73.5
    const u = utilityFor(camera(), "ai", { price: 500, extras: "none" });
    expect(u).toBeCloseTo(73.5, 1);
  });

  it("clamps number values outside best/worst to [0,1]", () => {
    const priceField = camera().offer_fields.find((f) => f.key === "price")!;
    const pref = camera().player_role.preferences["price"];
    expect(fieldValue(priceField, pref, 10_000)).toBe(0); // terrible for buyer
    expect(fieldValue(priceField, pref, 1)).toBe(1); // capped at best
  });

  it("is monotonic in the right direction per role", () => {
    const c = camera();
    const cheap = utilityFor(c, "player", { price: 400, extras: "none" });
    const dear = utilityFor(c, "player", { price: 500, extras: "none" });
    expect(cheap).toBeGreaterThan(dear);
    expect(utilityFor(c, "ai", { price: 500, extras: "none" })).toBeGreaterThan(
      utilityFor(c, "ai", { price: 400, extras: "none" })
    );
  });
});
