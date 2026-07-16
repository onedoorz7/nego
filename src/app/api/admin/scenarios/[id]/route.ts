import { NextRequest, NextResponse } from "next/server";
import { getScenario } from "@/lib/content/loader";
import { maxJointUtility, paretoFrontier, zopaExists } from "@/lib/engine/analysis";

/** Founder inspector: FULL scenario (hidden values included) plus computed
 * analysis so authored numbers can be sanity-checked before playtesting. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const scenario = getScenario(id);
    const frontier = paretoFrontier(scenario).map((p) => ({
      offer: p.offer,
      player: Math.round(p.player * 10) / 10,
      ai: Math.round(p.ai * 10) / 10,
    }));
    return NextResponse.json({
      scenario,
      analysis: {
        max_joint_utility: Math.round(maxJointUtility(scenario) * 10) / 10,
        zopa_exists: zopaExists(
          scenario,
          scenario.player_role.reservation_utility,
          scenario.ai_role.reservation_utility
        ),
        pareto_frontier: frontier,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unknown scenario" }, { status: 404 });
  }
}
