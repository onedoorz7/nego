import { describe, expect, it } from "vitest";
import { getScenario } from "@/lib/content/loader";
import { createSession, playTurn, submitPrep } from "@/lib/engine/session";
import { MockProvider } from "@/lib/llm/mock";
import type {
  DialogueContext,
  DialogueOutput,
  ModelCallLogger,
  NegotiationProvider,
} from "@/lib/llm/provider";
import type { SessionState } from "@/lib/types";

const scenario = () => getScenario("used-camera-001");
const noop: ModelCallLogger = () => {};
const mock = new MockProvider();

async function start(seed = 7): Promise<SessionState> {
  const st = createSession(scenario(), seed);
  return submitPrep(st, {
    goal: "buy the camera under budget",
    batna: "the $475 listing across town",
    reservation: 460,
    target: 420,
    opening: 400,
    questions: "why selling, condition, extras",
    avoid_reveal: "my budget cap",
  });
}

describe("session engine (mock provider, fixed seed)", () => {
  it("runs the full happy path: question → reveal → offer → counter → accept", async () => {
    let st = await start();

    // Question about why they're selling unlocks the cash-deadline fact.
    let r = await playTurn(scenario(), st, { type: "message", text: "Why are you selling it?" }, mock, noop);
    st = r.state;
    expect(r.new_reveals).toContain("needs_cash_friday");
    expect(st.revealed_info).toContain("needs_cash_friday");
    expect(st.transcript.filter((e) => e.speaker === "ai").length).toBe(1);

    // A reasonable-but-low offer draws a counter, not an acceptance.
    r = await playTurn(scenario(), st, { type: "offer", values: { price: 410, extras: "battery_bag" } }, mock, noop);
    st = r.state;
    expect(st.standing_offer?.by).toBe("ai");
    expect(st.offer_history.length).toBeGreaterThanOrEqual(2);

    // Accept the AI's counter → agreement with utilities recorded.
    r = await playTurn(scenario(), st, { type: "accept" }, mock, noop);
    st = r.state;
    expect(st.status).toBe("agreement");
    expect(st.outcome?.type).toBe("agreement");
    expect(st.outcome?.player_utility).not.toBeNull();
    expect(st.outcome?.ai_utility).not.toBeNull();
  });

  it("player walk-away ends the session", async () => {
    let st = await start(11);
    const r = await playTurn(scenario(), st, { type: "walk_away" }, mock, noop);
    st = r.state;
    expect(st.status).toBe("player_walked");
    expect(st.outcome?.final_offer).toBeNull();
  });

  it("hits the turn limit and ends without a deal", async () => {
    let st = await start(13);
    st.resolved.turn_limit = 3;
    for (let i = 0; i < 3; i++) {
      if (st.outcome) break;
      const r = await playTurn(scenario(), st, { type: "message", text: "Tell me more about the lens." }, mock, noop);
      st = r.state;
    }
    expect(st.status === "turn_limit" || st.status === "ai_walked").toBe(true);
  });

  it("fires scripted events at their turn and applies the threshold delta", async () => {
    let st = await start(17);
    for (let i = 0; i < 6 && !st.outcome; i++) {
      const r = await playTurn(scenario(), st, { type: "message", text: "Interesting." }, mock, noop);
      st = r.state;
    }
    expect(st.events_fired).toContain("another_buyer");
    expect(st.ai.event_threshold_delta).toBe(4);
    expect(st.transcript.some((e) => e.kind === "event")).toBe(true);
  });

  it("identical seeds resolve identical hidden parameters", () => {
    const a = createSession(scenario(), 12345);
    const b = createSession(scenario(), 12345);
    expect(a.resolved).toEqual(b.resolved);
  });

  it("rejects invalid player offers with a user error", async () => {
    const st = await start(19);
    await expect(
      playTurn(scenario(), st, { type: "offer", values: { price: 5, extras: "none" } }, mock, noop)
    ).rejects.toThrow(/between/);
  });

  it("rejects accept when there is no AI offer standing", async () => {
    const st = await start(23);
    await expect(playTurn(scenario(), st, { type: "accept" }, mock, noop)).rejects.toThrow(
      /no offer/i
    );
  });

  it("filters rogue provider reveal ids not allowed by the policy", async () => {
    const rogue: NegotiationProvider = {
      name: "rogue",
      async dialogue(ctx: DialogueContext): Promise<DialogueOutput> {
        return {
          message: "Let me tell you everything!",
          used_reveal_ids: ctx.scenario.ai_role.hidden_info.map((h) => h.id),
          provider: "rogue",
          fallback: false,
        };
      },
      async coach() {
        return null;
      },
    };
    let st = await start(29);
    const r = await playTurn(scenario(), st, { type: "message", text: "Hello there!" }, rogue, noop);
    st = r.state;
    // "Hello there!" matches no reveal topics → nothing may be revealed.
    expect(st.revealed_info).toEqual([]);
  });
});
