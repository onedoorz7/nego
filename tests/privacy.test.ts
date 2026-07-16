import { describe, expect, it } from "vitest";
import { getScenario, listScenarios } from "@/lib/content/loader";
import { createSession, playTurn, submitPrep } from "@/lib/engine/session";
import { MockProvider } from "@/lib/llm/mock";
import { publicScenario, publicSession } from "@/lib/redact";

/**
 * Private-information separation: everything the client can ever fetch during
 * a live game goes through publicScenario/publicSession. These tests assert
 * the AI's secrets are structurally absent from those shapes.
 */

describe("private-information separation", () => {
  it("publicScenario contains no AI secrets (all scenarios)", () => {
    for (const s of listScenarios()) {
      const json = JSON.stringify(publicScenario(s));
      expect(json).not.toContain(s.ai_role.private_brief.slice(0, 30));
      for (const h of s.ai_role.hidden_info) {
        expect(json, `${s.id} leaks hidden fact ${h.id}`).not.toContain(
          h.fact.slice(0, 30)
        );
      }
      const pub = publicScenario(s) as unknown as Record<string, unknown>;
      const aiRole = pub.ai_role as Record<string, unknown>;
      expect(aiRole.reservation_utility).toBeUndefined();
      expect(aiRole.target_utility).toBeUndefined();
      expect(aiRole.preferences).toBeUndefined();
      expect(aiRole.personality).toBeUndefined();
      expect(aiRole.hidden_info).toBeUndefined();
      expect(aiRole.batna).toBeUndefined();
    }
  });

  it("publicSession hides resolved params, AI internals, and unrevealed facts", async () => {
    const scenario = getScenario("used-camera-001");
    let state = submitPrep(createSession(scenario, 3), { goal: "x" });
    const r = await playTurn(
      scenario,
      state,
      { type: "message", text: "Why are you selling?" },
      new MockProvider(),
      () => {}
    );
    state = r.state;

    const pub = publicSession(state, scenario) as unknown as Record<string, unknown>;
    expect(pub.resolved).toBeUndefined();
    expect(pub.ai).toBeUndefined();
    expect(pub.seed).toBeUndefined();

    const json = JSON.stringify(pub);
    // Revealed fact IS present…
    const revealed = scenario.ai_role.hidden_info.find((h) =>
      state.revealed_info.includes(h.id)
    );
    if (revealed) expect(json).toContain(revealed.fact.slice(0, 20));
    // …but unrevealed facts are not (checked via a distinctive fragment that
    // the AI's dialogue can't have paraphrased into the transcript verbatim).
    for (const h of scenario.ai_role.hidden_info) {
      if (state.revealed_info.includes(h.id)) continue;
      expect(json, `unrevealed fact ${h.id} leaked`).not.toContain(h.fact.slice(0, 30));
    }
    // The AI reservation never appears as a number in any live payload field.
    expect(json).not.toContain("reservation_utility");
  });

  it("live outcome hides the AI's utility until the debrief", async () => {
    const scenario = getScenario("used-camera-001");
    let state = submitPrep(createSession(scenario, 5), { goal: "x" });
    let r = await playTurn(
      scenario,
      state,
      { type: "offer", values: { price: 560, extras: "none" } },
      new MockProvider(),
      () => {}
    );
    state = r.state;
    expect(state.status).toBe("agreement");
    const pub = publicSession(state, scenario);
    expect(pub.outcome).not.toBeNull();
    expect((pub.outcome as Record<string, unknown>).ai_utility).toBeUndefined();
  });
});
