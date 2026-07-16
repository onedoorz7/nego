import { NextResponse } from "next/server";
import { getLearningPath, getProgress } from "@/lib/progress";

export async function GET() {
  return NextResponse.json({ progress: getProgress(), path: getLearningPath() });
}
