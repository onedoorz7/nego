import { describe, expect, it } from "vitest";
import { getScenario } from "@/lib/content/loader";
import { formatOffer, offersEqual, validateOffer } from "@/lib/engine/offers";

const camera = () => getScenario("used-camera-001");

describe("offer validation", () => {
  it("accepts a valid offer and snaps to the step grid", () => {
    const r = validateOffer(camera(), { price: 433, extras: "none" });
    expect(r.ok).toBe(true);
    expect(r.values.price).toBe(435); // step 5
  });

  it("rejects out-of-range numbers", () => {
    const r = validateOffer(camera(), { price: 9999, extras: "none" });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/between/);
  });

  it("rejects wrong types and missing fields", () => {
    expect(validateOffer(camera(), { price: "abc", extras: "none" }).ok).toBe(false);
    expect(validateOffer(camera(), { price: 450 }).ok).toBe(false);
  });

  it("rejects invalid select options and unknown fields", () => {
    expect(validateOffer(camera(), { price: 450, extras: "gold_plating" }).ok).toBe(false);
    const r = validateOffer(camera(), { price: 450, extras: "none", bribe: 100 });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/Unknown offer field/);
  });

  it("offersEqual and formatOffer behave", () => {
    expect(offersEqual({ a: 1, b: "x" }, { a: 1, b: "x" })).toBe(true);
    expect(offersEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(formatOffer(camera(), { price: 450, extras: "battery_bag" })).toMatch(/\$450/);
  });
});
