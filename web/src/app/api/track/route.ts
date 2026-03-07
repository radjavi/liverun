import { NextRequest, NextResponse } from "next/server";
import { desc, eq, gt, sql } from "drizzle-orm";
import db from "@/db";
import { trackingPoints, cheers } from "@/db/schema";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const points = Array.isArray(body) ? body : [body];

  const rows = points.map((p: Record<string, unknown>) => {
    if (!p.runId || p.latitude == null || p.longitude == null || !p.recordedAt) {
      throw new Error("Missing required fields: runId, latitude, longitude, recordedAt");
    }
    return {
      runId: p.runId as string,
      latitude: p.latitude as number,
      longitude: p.longitude as number,
      altitude: (p.altitude as number) ?? null,
      heartRate: p.heartRate != null ? Math.round(p.heartRate as number) : null,
      pace: (p.pace as number) ?? null,
      distanceMeters: (p.distanceMeters as number) ?? null,
      cadence: p.cadence != null ? Math.round(p.cadence as number) : null,
      elevationGain: (p.elevationGain as number) ?? null,
      gradeAdjustedPace: (p.gradeAdjustedPace as number) ?? null,
      recordedAt: new Date(p.recordedAt as string),
    };
  });

  await db.insert(trackingPoints).values(rows);

  // Piggyback cheer data on the response
  const runId = rows[0].runId;
  const afterParam = request.nextUrl.searchParams.get("cheersAfter");
  const after = afterParam ? Number(afterParam) : 0;

  const cheerRows = await db
    .select()
    .from(cheers)
    .where(sql`${cheers.runId} = ${runId} AND ${cheers.id} > ${after}`)
    .orderBy(desc(cheers.id));

  const cheerCount = cheerRows.length;
  const highlight = cheerCount > 0 ? cheerRows[Math.floor(Math.random() * cheerCount)] : null;
  const lastCheerSeenId = cheerCount > 0 ? cheerRows[0].id : after;

  return NextResponse.json({
    ok: true,
    cheers: {
      count: cheerCount,
      highlight: highlight ? { id: highlight.id, message: highlight.message } : null,
      lastId: lastCheerSeenId,
    },
  });
}
