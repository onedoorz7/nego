import { describe, expect, it } from "vitest";
import { getScenario } from "@/lib/content/loader";
import { decide } from "@/lib/engine/policy";
import { createSession, playTurn, submitPrep } from "@/lib/engine/session";
import { utilityFor } from "@/lib/engine/utility";
import { MockProvider } from "@/lib/llm/mock";
import { publicSession } from "@/lib/redact";
import type { SessionState } from "@/lib/types";

const scenario = () => getScenario("used-camera-001");
const mock = new MockProvider();
const noop = () => {};

function quickStart(seed = 51): SessionState {
  return submitPrep(createSession(scenario(), seed), {});
}

describe("Ask move (probe cards)", () => {
  it("unlocks its secret deterministically and costs a move", async () => {
    let st = quickStart();
    const r = await playTurn(scenario(), st, { type: "probe", info_id: "needs_cash_friday" }, mock, noop);
    st = r.state;
    expect(r.new_reveals).toEqual(["needs_cash_friday"]);
    expect(st.turn).toBe(1);
    // The question shows up as a spoken player line.
    expect(st.transcript[0].kind).toBe("message");
    expect(st.transcript[0].text).toMatch(/why are you selling/i);
  });

  it("rejects unknown probe ids", async () => {
    const st = quickStart();
    await expect(
      playTurn(scenario(), st, { type: "probe", info_id: "nope" }, mock, noop)
    ).rejects.toThrow(/unknown question/i);
  });

  it("every shipped scenario has a probe card for every secret", () => {
    for (const id of ["used-camera-001", "freelance-website-001", "salary-offer-001"]) {
      const s = getScenario(id);
      for (const h of s.ai_role.hidden_info) {
        expect(h.probe, `${id}/${h.id} missing probe`).toBeTruthy();
      }
    }
  });
});

describe("Flinch move", () => {
  it("requires an AI offer on the table", async () => {
    const st = quickStart();
    await expect(playTurn(scenario(), st, { type: "flinch" }, mock, noop)).rejects.toThrow(
      /no offer/i
    );
  });

  it("softens their threshold twice, then they see through it", async () => {
    let st = quickStart(53);
    // Draw out an AI offer first (patience runs out).
    for (let i = 0; i < 5 && !st.standing_offer; i++) {
      const r = await playTurn(scenario(), st, { type: "silence" }, mock, noop);
      st = r.state;
    }
    expect(st.standing_offer?.by).toBe("ai");
    // Pre-mark scripted events as fired so their deltas can't muddy the math.
    st.events_fired = scenario().events.map((e) => e.id);
    const d0 = st.ai.event_threshold_delta;

    let r = await playTurn(scenario(), st, { type: "flinch" }, mock, noop);
    st = r.state;
    expect(st.ai.event_threshold_delta).toBe(d0 - 2);
    r = await playTurn(scenario(), st, { type: "flinch" }, mock, noop);
    st = r.state;
    expect(st.ai.event_threshold_delta).toBe(d0 - 4);
    // Third flinch: no further effect.
    r = await playTurn(scenario(), st, { type: "flinch" }, mock, noop);
    st = r.state;
    expect(st.ai.event_threshold_delta).toBe(d0 - 4);
    expect(st.ai.flinches_used).toBe(3);
  });
});

describe("Silence move", () => {
  it("squeezes a sweeter offer out of a decayed opponent", () => {
    const s = scenario();
    const st = quickStart(57);
    st.status = "active";
    st.turn = 6;
    st.ai.offers_made = 1;
    // The AI opened high earlier; its standing level has since decayed.
    const high = { price: 530, extras: "none" };
    st.offer_history = [{ by: "ai", values: high, turn: 2 }];
    st.standing_offer = { by: "ai", values: high, turn: 2 };

    const d = decide({
      scenario: s,
      state: st,
      action: { type: "silence" },
      unlocked_info: [],
    });
    expect(d.intent).toBe("counter_offer");
    expect(d.offer).not.toBeNull();
    // Sweeter for the player than what was standing.
    expect(utilityFor(s, "player", d.offer!)).toBeGreaterThan(
      utilityFor(s, "player", high)
    );
  });

  it("stops working after three consecutive silences", () => {
    const s = scenario();
    const st = quickStart(59);
    st.status = "active";
    st.turn = 2; // within patience, so the forced-opening rule can't preempt
    st.ai.silence_streak = 3;
    const d = decide({
      scenario: s,
      state: st,
      action: { type: "silence" },
      unlocked_info: [],
    });
    expect(d.intent).toBe("nudge");
  });
});

describe("Final offer (all-in)", () => {
  function pinned(seed: number): SessionState {
    const st = quickStart(seed);
    st.status = "active";
    st.resolved.ai_reservation_utility = 22;
    st.resolved.ai_target_utility = 60;
    return st;
  }

  it("gets accepted with the take-it-or-leave-it discount", () => {
    const s = scenario();
    const st = pinned(61);
    st.turn = 1;
    const values = { price: 465, extras: "none" }; // au ≈ 55: below 60, above 60-6
    st.standing_offer = { by: "player", values, turn: 1 };
    st.offer_history = [st.standing_offer];

    const normal = decide({ scenario: s, state: st, action: { type: "offer" }, unlocked_info: [] });
    expect(normal.intent).toBe("counter_offer"); // not good enough normally

    const final = decide({
      scenario: s,
      state: st,
      action: { type: "offer", final: true },
      unlocked_info: [],
    });
    expect(final.intent).toBe("accept"); // …but final closes it
  });

  it("a bad final offer draws a warning, then the walk", () => {
    const s = scenario();
    const st = pinned(63);
    st.turn = 2;
    const values = { price: 380, extras: "none" }; // au ≈ 10, below reservation
    st.standing_offer = { by: "player", values, turn: 2 };
    st.offer_history = [st.standing_offer];

    const first = decide({ scenario: s, state: st, action: { type: "offer", final: true }, unlocked_info: [] });
    expect(first.intent).toBe("warn_walk");

    st.ai.warned_walk = true;
    const second = decide({ scenario: s, state: st, action: { type: "offer", final: true }, unlocked_info: [] });
    expect(second.intent).toBe("walk_away");
  });

  it("bluffing a final and then offering again breaks credibility (+5 threshold, once)", async () => {
    let st = quickStart(67);
    let r = await playTurn(
      scenario(), st,
      { type: "offer", values: { price: 405, extras: "none" }, final: true },
      mock, noop
    );
    st = r.state;
    if (st.outcome) return; // seed guard: warn path keeps the game alive
    expect(st.ai.final_declared).toBe(true);
    const d0 = st.ai.event_threshold_delta;

    r = await playTurn(
      scenario(), st,
      { type: "offer", values: { price: 430, extras: "none" } },
      mock, noop
    );
    st = r.state;
    expect(st.ai.credibility_broken).toBe(true);
    expect(st.ai.event_threshold_delta).toBe(d0 + 5);
    expect(st.transcript.some((e) => e.text.includes("supposed to be final"))).toBe(true);

    if (st.outcome) return;
    // Penalty applies once, not per offer.
    r = await playTurn(
      scenario(), st,
      { type: "offer", values: { price: 440, extras: "none" } },
      mock, noop
    );
    expect(r.state.ai.event_threshold_delta).toBe(d0 + 5);
  });
});

describe("the pot preview", () => {
  it("publicSession prices the standing AI offer in arcade points", async () => {
    let st = quickStart(69);
    for (let i = 0; i < 5 && !st.standing_offer; i++) {
      const r = await playTurn(scenario(), st, { type: "silence" }, mock, noop);
      st = r.state;
    }
    expect(st.standing_offer?.by).toBe("ai");
    const pub = publicSession(st, scenario());
    expect(typeof pub.standing_offer_points).toBe("number");
  });
});
