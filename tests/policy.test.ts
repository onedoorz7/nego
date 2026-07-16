import { describe, expect, it } from "vitest";
import { getScenario } from "@/lib/content/loader";
import { acceptanceThreshold, counterLevel, decide } from "@/lib/engine/policy";
import { createSession } from "@/lib/engine/session";
import { utilityFor } from "@/lib/engine/utility";
import type { SessionState } from "@/lib/types";

const scenario = () => getScenario("used-camera-001");

function activeSession(seed = 42): SessionState {
  const s = createSession(scenario(), seed);
  return { ...s, status: "active" };
}

function withPlayerOffer(
  state: SessionState,
  values: Record<string, number | string>,
  turn = 1
): SessionState {
  const offer = { by: "player" as const, values, turn };
  return {
    ...state,
    turn,
    standing_offer: offer,
    offer_history: [...state.offer_history, offer],
  };
}

describe("acceptance threshold", () => {
  it("starts at target, decays monotonically, never below reservation", () => {
    const s = scenario();
    const st = activeSession();
    let prev = Infinity;
    for (let turn = 1; turn <= 30; turn++) {
      const th = acceptanceThreshold(s, st.resolved, turn, 0);
      expect(th).toBeLessThanOrEqual(prev + 1e-9);
      expect(th).toBeGreaterThanOrEqual(st.resolved.ai_reservation_utility);
      prev = th;
    }
    expect(acceptanceThreshold(s, st.resolved, 1, 0)).toBeCloseTo(
      st.resolved.ai_target_utility,
      5
    );
  });

  it("event deltas shift the threshold but respect the reservation floor", () => {
    const s = scenario();
    const st = activeSession();
    const base = acceptanceThreshold(s, st.resolved, 3, 0);
    expect(acceptanceThreshold(s, st.resolved, 3, 4)).toBeCloseTo(base + 4, 5);
    expect(
      acceptanceThreshold(s, st.resolved, 30, -50)
    ).toBeGreaterThanOrEqual(st.resolved.ai_reservation_utility);
  });
});

describe("opponent policy invariants", () => {
  it("NEVER accepts an offer below its reservation (all turns, all offers)", () => {
    const s = scenario();
    for (let turn = 1; turn <= 12; turn++) {
      for (let price = 300; price <= 600; price += 20) {
        const base = activeSession();
        const st = withPlayerOffer(base, { price, extras: "none" }, turn);
        st.resolved.turn_limit = 12;
        const d = decide({
          scenario: s,
          state: st,
          action: { type: "offer" },
          unlocked_info: [],
        });
        const au = utilityFor(s, "ai", { price, extras: "none" });
        if (d.intent === "accept") {
          expect(au).toBeGreaterThanOrEqual(st.resolved.ai_reservation_utility);
        }
      }
    }
  });

  it("accepts an offer at/above its current threshold", () => {
    const s = scenario();
    const st = withPlayerOffer(activeSession(), { price: 560, extras: "none" }, 2);
    const d = decide({ scenario: s, state: st, action: { type: "offer" }, unlocked_info: [] });
    expect(d.intent).toBe("accept");
  });

  it("counter-offers always meet its own current standards", () => {
    const s = scenario();
    for (let turn = 1; turn <= 10; turn++) {
      const st = withPlayerOffer(activeSession(), { price: 405, extras: "none" }, turn);
      st.resolved.turn_limit = 12;
      const d = decide({ scenario: s, state: st, action: { type: "offer" }, unlocked_info: [] });
      if (d.intent === "counter_offer" && d.offer) {
        const au = utilityFor(s, "ai", d.offer);
        expect(au).toBeGreaterThanOrEqual(st.resolved.ai_reservation_utility - 1e-6);
      }
    }
  });

  it("counter level decays toward but never below the threshold floor", () => {
    const s = scenario();
    const st = activeSession();
    let prev = Infinity;
    for (let offers = 0; offers < 12; offers++) {
      const lvl = counterLevel(s, st.resolved, { ...st.ai, offers_made: offers }, 3);
      expect(lvl).toBeLessThanOrEqual(prev + 1e-9);
      expect(lvl).toBeGreaterThanOrEqual(st.resolved.ai_reservation_utility);
      prev = lvl;
    }
  });

  it("warns before walking after repeated insulting offers", () => {
    const s = scenario();
    // Deep lowball: bottom price AND demanding the full kit (AI utility ≈ 1.5).
    const st = withPlayerOffer(activeSession(), { price: 300, extras: "full_kit" }, 3);
    st.resolved.ai_reservation_utility = 22; // pin variation for determinism
    st.ai.frustration = 2; // two insults already
    const d = decide({ scenario: s, state: st, action: { type: "offer" }, unlocked_info: [] });
    expect(d.intent).toBe("warn_walk");
    st.ai.warned_walk = true;
    const d2 = decide({ scenario: s, state: st, action: { type: "offer" }, unlocked_info: [] });
    expect(d2.intent).toBe("walk_away");
  });

  it("opens with its own offer once patience runs out", () => {
    const s = scenario();
    const st = activeSession();
    st.turn = s.ai_role.personality.patience + 1;
    const d = decide({
      scenario: s,
      state: st,
      action: { type: "message", text: "Nice weather today." },
      unlocked_info: [],
    });
    expect(d.intent).toBe("first_offer");
    expect(d.offer).not.toBeNull();
  });

  it("only allows reveals the player's message unlocked", () => {
    const s = scenario();
    const st = activeSession();
    st.turn = 1;
    const d = decide({
      scenario: s,
      state: st,
      action: { type: "message", text: "Why are you selling it?" },
      unlocked_info: ["needs_cash_friday"],
    });
    expect(d.allowed_reveals).toEqual(["needs_cash_friday"]);
    const d2 = decide({
      scenario: s,
      state: st,
      action: { type: "message", text: "Hello!" },
      unlocked_info: [],
    });
    expect(d2.allowed_reveals).toEqual([]);
  });
});
