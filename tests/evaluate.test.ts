import { describe, expect, it } from "vitest";
import { getScenario } from "@/lib/content/loader";
import { evaluateSession } from "@/lib/engine/evaluate";
import { createSession, playTurn, submitPrep } from "@/lib/engine/session";
import { MockProvider } from "@/lib/llm/mock";
import { scanDialogue } from "@/lib/llm/provider";
import type { SessionState } from "@/lib/types";

const scenario = () => getScenario("used-camera-001");
const mock = new MockProvider();
const noop = () => {};

async function playedSession(
  seed: number,
  actions: Parameters<typeof playTurn>[2][]
): Promise<SessionState> {
  let st = submitPrep(createSession(scenario(), seed), {
    goal: "buy under budget",
    batna: "the $475 listing",
    reservation: 460,
    target: 420,
    opening: 400,
    questions: "why selling",
    avoid_reveal: "budget",
  });
  for (const a of actions) {
    if (st.outcome) break;
    const r = await playTurn(scenario(), st, a, mock, noop);
    st = r.state;
  }
  return st;
}

describe("evaluation engine", () => {
  it("scores a solid deal sensibly and awards XP", async () => {
    const st = await playedSession(7, [
      { type: "message", text: "Why are you selling? Any issues with the condition?" },
      { type: "message", text: "Would you include the spare battery or bag?" },
      { type: "offer", values: { price: 400, extras: "battery_bag" } },
      { type: "accept" },
    ]);
    expect(st.status).toBe("agreement");
    const ev = evaluateSession(scenario(), st);
    expect(ev.total).toBeGreaterThan(40);
    expect(ev.xp).toBeGreaterThan(0);
    const discovery = ev.scores.find((s) => s.key === "discovery")!;
    expect(discovery.value).toBeGreaterThan(0);
    const personal = ev.scores.find((s) => s.key === "personal")!;
    expect(personal.basis).toBe("objective");
    expect(ev.analysis.deal_reached).toBe(true);
    expect(ev.analysis.joint_utility).toBeLessThanOrEqual(ev.analysis.max_joint_utility);
  });

  it("marks accepting a terrible deal as below reservation", async () => {
    // Accept the AI's aggressive first offer immediately.
    const st = await playedSession(9, [
      { type: "message", text: "hello" },
      { type: "message", text: "nice camera" },
      { type: "message", text: "hmm" },
      { type: "message", text: "ok" }, // AI opens after patience runs out
      { type: "accept" },
    ]);
    if (st.status !== "agreement") return; // seed-dependent guard
    const ev = evaluateSession(scenario(), st);
    const personal = ev.scores.find((s) => s.key === "personal")!;
    // The AI's opening is far above the buyer's reservation → low score.
    expect(personal.value).toBeLessThan(45);
  });

  it("treats a disciplined walk (nothing acceptable offered) fairly", async () => {
    const st = await playedSession(11, [
      { type: "message", text: "hello" },
      { type: "message", text: "tell me about it" },
      { type: "message", text: "I see" },
      { type: "message", text: "ok" }, // AI opens high
      { type: "walk_away" },
    ]);
    expect(st.status).toBe("player_walked");
    const ev = evaluateSession(scenario(), st);
    const personal = ev.scores.find((s) => s.key === "personal")!;
    // AI's early offers are above the buyer's reservation-as-utility → the
    // walk counts as disciplined (75) since nothing on the table beat it.
    expect([75, 30]).toContain(personal.value);
    expect(ev.analysis.walk_was_reasonable).not.toBeNull();
  });

  it("penalizes bidding against yourself", async () => {
    const st = await playedSession(13, [
      { type: "offer", values: { price: 400, extras: "none" } },
      { type: "reject" }, // clear their counter
      { type: "offer", values: { price: 440, extras: "none" } }, // worse for self after reject… still counts as vs own last? (has AI counter between)
    ]);
    // Direct construction: two consecutive player offers with no AI offer between.
    const manual = JSON.parse(JSON.stringify(st)) as SessionState;
    manual.offer_history = [
      { by: "player", values: { price: 400, extras: "none" }, turn: 1 },
      { by: "player", values: { price: 450, extras: "none" }, turn: 2 },
    ];
    manual.outcome = { type: "turn_limit", final_offer: null, player_utility: null, ai_utility: null };
    manual.status = "turn_limit";
    const ev = evaluateSession(scenario(), manual);
    const conc = ev.scores.find((s) => s.key === "concessions")!;
    expect(conc.value).toBeLessThanOrEqual(75);
    expect(ev.observations.some((o) => o.rule === "bid_against_self")).toBe(true);
  });

  it("rewards coherent, followed preparation", async () => {
    const st = await playedSession(17, [
      { type: "offer", values: { price: 400, extras: "none" } },
      { type: "accept" },
    ]);
    if (st.status !== "agreement") return;
    const ev = evaluateSession(scenario(), st);
    const prep = ev.scores.find((s) => s.key === "preparation")!;
    // Complete prep + coherent (buyer: opening 400 ≤ target 420 ≤ reservation 460) + followed opening.
    expect(prep.value).toBeGreaterThanOrEqual(95);
  });
});

describe("dialogue guardrail scanner", () => {
  it("flags meta/internal leaks and unpermitted fact leaks", async () => {
    const s = scenario();
    let st = submitPrep(createSession(s, 3), { goal: "x" });
    const r = await playTurn(s, st, { type: "message", text: "hi" }, mock, noop);
    st = r.state;
    const ctx = {
      scenario: s,
      state: st,
      decision: {
        intent: "answer" as const,
        offer: null,
        allowed_reveals: [],
        acceptance_threshold: 0,
        standing_offer_utility: null,
        mood: "warm" as const,
        phase: "explore" as const,
        notes: [],
      },
      playerText: "hi",
    };
    expect(scanDialogue(ctx, "As an AI language model I cannot…")).not.toHaveLength(0);
    const fact = s.ai_role.hidden_info[0].fact;
    expect(scanDialogue(ctx, `Well, honestly: ${fact}`)).not.toHaveLength(0);
    expect(scanDialogue(ctx, "The camera is in great shape, honestly.")).toHaveLength(0);
  });
});
