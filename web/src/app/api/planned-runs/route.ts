import { NextRequest, NextResponse } from "next/server";
import { eq, and, gt, isNull, isNotNull, asc } from "drizzle-orm";
import db from "@/db";
import { runs } from "@/db/schema";
import { getSessionFromRequest } from "@/lib/auth-server";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 60 * 60 * 1000);

  const rows = await db
    .select({
      id: runs.id,
      name: runs.name,
      raceId: runs.raceId,
      plannedStartTime: runs.plannedStartTime,
    })
    .from(runs)
    .where(
      and(
        eq(runs.userId, session.user.id),
        isNotNull(runs.plannedStartTime),
        isNull(runs.startedAt),
        isNull(runs.endedAt),
        gt(runs.plannedStartTime, cutoff),
      ),
    )
    .orderBy(asc(runs.plannedStartTime));

  return NextResponse.json(rows);
}
