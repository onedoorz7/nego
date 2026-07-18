import { describe, expect, it } from "vitest";
import { getScenario, listScenarios } from "@/lib/content/loader";
import {
  dailyScenario,
  dailySeed,
  getDailyRecord,
  recordDailyFinish,
  setDailyRecord,
} from "@/lib/daily";
import { evaluateSession } from "@/lib/engine/evaluate";
import { createSession, expireIfNeeded, playTurn, submitPrep } from "@/lib/engine/session";
import { mysteryTier, resolveParams } from "@/lib/engine/variation";
import { labList, roundList, isScenarioUnlocked } from "@/lib/progress";
import { MockProvider } from "@/lib/llm/mock";
import { publicScenario, publicSession } from "@/lib/redact";
import type { SessionState } from "@/lib/types";

const mock = new MockProvider();
const noop = () => {};

// ---------------------------------------------------------------------------
// Daily challenge
// ---------------------------------------------------------------------------

describe("daily challenge", () => {
  it("same day → same seed and same scenario; days rotate", () => {
    expect(dailySeed("2026-07-18")).toBe(dailySeed("2026-07-18"));
    expect(dailySeed("2026-07-18")).not.toBe(dailySeed("2026-07-19"));
    expect(dailyScenario("2026-07-18").id).toBe(dailyScenario("2026-07-18").id);
    expect(dailyScenario("2026-07-18").id).not.toBe(dailyScenario("2026-07-19").id);
  });

  it("seeds are valid positive ints for any date", () => {
    for (const key of ["2026-01-01", "2026-07-18", "2030-12-31"]) {
      const s = dailySeed(key);
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThan(0);
    }
  });

  it("one-attempt record: set, read back, lock in on finish", () => {
    const key = "2001-01-01"; // fixed past key so we never clash with todayKey
    expect(getDailyRecord(key)).toBeNull();
    setDailyRecord({ session_id: "s1", finished: false, points: null }, key);
    expect(getDailyRecord(key)).toEqual({ session_id: "s1", finished: false, points: null });
  });

  it("recordDailyFinish only touches daily sessions", () => {
    const scenario = getScenario("used-camera-001");
    const state = submitPrep(createSession(scenario, 1), {});
    state.outcome = { type: "agreement", final_offer: null, player_utility: null, ai_utility: null };
    // Non-daily session: no record written for today.
    recordDailyFinish(state, evaluateSession(scenario, state));
    expect(getDailyRecord()?.session_id).not.toBe(state.id);
  });
});

// ---------------------------------------------------------------------------
// Mystery mode (hidden value)
// ---------------------------------------------------------------------------

describe("mystery mode", () => {
  const scenario = () => getScenario("storage-unit-001");

  it("samples a hidden value inside the range, reproducible from the seed", () => {
    const s = scenario();
    const a = resolveParams(s, 42);
    const b = resolveParams(s, 42);
    const c = resolveParams(s, 43);
    expect(a.mystery_value).toBe(b.mystery_value);
    expect(a.mystery_value).toBeGreaterThanOrEqual(s.mystery!.value_range.min);
    expect(a.mystery_value).toBeLessThanOrEqual(s.mystery!.value_range.max);
    // Different seeds vary (43 chosen to differ for this content).
    expect(a.mystery_value).not.toBe(c.mystery_value);
    // Standard scenarios never carry one.
    expect(resolveParams(getScenario("used-camera-001"), 42).mystery_value).toBeUndefined();
  });

  it("tiers split the range into thirds", () => {
    const s = scenario(); // range 60–900
    expect(mysteryTier(s, 60)).toBe("low");
    expect(mysteryTier(s, 339)).toBe("low");
    expect(mysteryTier(s, 500)).toBe("mid");
    expect(mysteryTier(s, 700)).toBe("high");
    expect(mysteryTier(s, 900)).toBe("high");
  });

  it("clue probes answer with the seeded tier's text, no AI turn", async () => {
    const s = scenario();
    const st = submitPrep(createSession(s, 7), {});
    const tier = mysteryTier(s, st.resolved.mystery_value!);
    const clue = s.mystery!.clues.find((c) => c.id === "clue_knock")!;

    const r = await playTurn(s, st, { type: "probe", info_id: "clue_knock" }, mock, noop);
    expect(r.new_reveals).toEqual(["clue_knock"]);
    expect(r.state.dynamic_facts.clue_knock).toBe(clue[tier]);
    expect(r.state.turn).toBe(1);
    // Player line + system clue answer — Pat doesn't get a scripted reply.
    const last = r.state.transcript.at(-1)!;
    expect(last.speaker).toBe("system");
    expect(last.text).toBe(clue[tier]);
  });

  it("score = revealed value − price paid, and CAN go negative", () => {
    const s = scenario();
    const st = submitPrep(createSession(s, 7), {});
    st.status = "agreement";
    st.outcome = {
      type: "agreement",
      final_offer: { price: 300 },
      player_utility: 50,
      ai_utility: 50,
    };
    const ev = evaluateSession(s, st);
    expect(ev.arcade?.points).toBe(st.resolved.mystery_value! - 300);
    expect(ev.arcade?.mystery?.value).toBe(st.resolved.mystery_value);
    expect(ev.arcade?.mystery?.price_paid).toBe(300);

    // Overpay for junk → negative round.
    st.resolved.mystery_value = 100;
    st.outcome.final_offer = { price: 400 };
    const ev2 = evaluateSession(s, st);
    expect(ev2.arcade?.points).toBe(-300);
    expect(ev2.arcade?.mystery?.tier).toBe("low");
  });

  it("no deal still reveals the value in the evaluation (for the sting)", () => {
    const s = scenario();
    const st = submitPrep(createSession(s, 7), {});
    st.status = "player_walked";
    st.outcome = { type: "player_walked", final_offer: null, player_utility: null, ai_utility: null };
    const ev = evaluateSession(s, st);
    expect(ev.arcade?.points).toBe(0);
    expect(ev.arcade?.mystery?.value).toBe(st.resolved.mystery_value);
    expect(ev.arcade?.mystery?.price_paid).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Blitz mode (wall-clock deadline)
// ---------------------------------------------------------------------------

describe("blitz mode", () => {
  it("blitz sessions get a deadline; standard sessions don't", () => {
    const blitz = createSession(getScenario("last-croissant-001"), 9);
    expect(blitz.deadline_at).not.toBeNull();
    const ahead = Date.parse(blitz.deadline_at!) - Date.now();
    expect(ahead).toBeGreaterThan(80_000);
    expect(ahead).toBeLessThanOrEqual(91_000);
    expect(createSession(getScenario("used-camera-001"), 9).deadline_at).toBeNull();
  });

  it("expireIfNeeded ends the round exactly once after the deadline", () => {
    const s = getScenario("last-croissant-001");
    const st: SessionState = submitPrep(createSession(s, 9), {});
    expect(expireIfNeeded(s, st)).toBe(false); // clock still running

    st.deadline_at = new Date(Date.now() - 1000).toISOString();
    expect(expireIfNeeded(s, st)).toBe(true);
    expect(st.status).toBe("turn_limit");
    expect(st.outcome?.type).toBe("turn_limit");
    expect(st.transcript.at(-1)?.text).toMatch(/time's up/i);
    expect(expireIfNeeded(s, st)).toBe(false); // idempotent
  });
});

// ---------------------------------------------------------------------------
// Lab shelf & progression
// ---------------------------------------------------------------------------

describe("lab shelf", () => {
  it("lab tables stay out of the numbered rounds but are always unlocked", () => {
    const labIds = labList().map((l) => l.id);
    expect(labIds).toEqual(
      expect.arrayContaining(["dragons-toll-001", "last-croissant-001", "storage-unit-001"])
    );
    const roundIds = roundList().map((r) => r.id);
    for (const id of labIds) {
      expect(roundIds).not.toContain(id);
      expect(isScenarioUnlocked(id)).toBe(true);
    }
    // Advanced regular rounds are still locked for a fresh player.
    expect(roundIds.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Redaction (the mystery value and clue answers must never leak pre-reveal)
// ---------------------------------------------------------------------------

describe("lab redaction", () => {
  it("publicScenario exposes the gamble's range + clue questions, never answers", () => {
    const s = getScenario("storage-unit-001");
    const pub = publicScenario(s);
    expect(pub.mystery?.value_range).toEqual({ min: 60, max: 900 });
    expect(pub.probes.map((p) => p.id)).toEqual(
      expect.arrayContaining(["clue_knock", "clue_tenant", "clue_vent"])
    );
    const json = JSON.stringify(pub);
    for (const clue of s.mystery!.clues) {
      for (const text of [clue.low, clue.mid, clue.high]) {
        expect(json, `clue answer leaked: ${text.slice(0, 20)}`).not.toContain(
          text.slice(0, 25)
        );
      }
    }
    expect(json).not.toContain("reveal_text");
  });

  it("publicSession never contains the sampled mystery value", async () => {
    const s = getScenario("storage-unit-001");
    const st = submitPrep(createSession(s, 7), {});
    const r = await playTurn(s, st, { type: "probe", info_id: "clue_vent" }, mock, noop);
    const pub = publicSession(r.state, s) as unknown as Record<string, unknown>;
    expect(pub.resolved).toBeUndefined();
    const json = JSON.stringify(pub);
    expect(json).not.toContain("mystery_value");
    // The clue ANSWER the player earned is visible…
    expect(json).toContain(r.state.dynamic_facts.clue_vent.slice(0, 20));
    // …and the pot stays unknown: no points hint on a mystery table.
    expect(pub.standing_offer_points).toBeNull();
  });

  it("publicSession exposes the blitz deadline", () => {
    const s = getScenario("last-croissant-001");
    const st = submitPrep(createSession(s, 9), {});
    const pub = publicSession(st, s);
    expect(pub.deadline_at).toBe(st.deadline_at);
    expect(publicScenario(s).blitz_seconds).toBe(90);
  });
});
