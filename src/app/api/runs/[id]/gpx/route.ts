import { NextRequest, NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import db from "@/db";
import { runs, trackingPoints } from "@/db/schema";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const run = await db.query.runs.findFirst({
    where: eq(runs.id, id),
  });
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const points = await db
    .select()
    .from(trackingPoints)
    .where(eq(trackingPoints.runId, id))
    .orderBy(asc(trackingPoints.recordedAt));

  if (points.length === 0) {
    return NextResponse.json({ error: "No tracking data" }, { status: 404 });
  }

  const trkpts = points
    .map((p) => {
      const extensions =
        p.heartRate != null
          ? `\n        <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${p.heartRate}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>`
          : "";
      return `      <trkpt lat="${p.latitude}" lon="${p.longitude}">
        <ele>${p.altitude ?? 0}</ele>
        <time>${p.recordedAt.toISOString()}</time>${extensions}
      </trkpt>`;
    })
    .join("\n");

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="LiveRun"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <trk>
    <name>LiveRun ${run.startedAt.toISOString().split("T")[0]}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;

  return new NextResponse(gpx, {
    headers: {
      "Content-Type": "application/gpx+xml",
      "Content-Disposition": `attachment; filename="liverun-${id}.gpx"`,
    },
  });
}
