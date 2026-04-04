import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import db from "@/db";
import { runs, trackingPoints, cheers } from "@/db/schema";
import { getSessionFromRequest } from "@/lib/auth-server";

async function getOwnedRun(request: NextRequest, id: string) {
  const session = await getSessionFromRequest(request);
  if (!session) return null;

  const [run] = await db
    .select({ userId: runs.userId })
    .from(runs)
    .where(eq(runs.id, id));

  if (!run || run.userId !== session.user.id) return null;
  return run;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = await getOwnedRun(request, id);
  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Record<string, Date> = {};
  try {
    const body = await request.json();
    if (body.endedAt) updates.endedAt = new Date(body.endedAt);
    if (body.startedAt) updates.startedAt = new Date(body.startedAt);
  } catch {
    // No body — default to ending now
    updates.endedAt = new Date();
  }

  await db.update(runs).set(updates).where(eq(runs.id, id));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = await getOwnedRun(request, id);
  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(trackingPoints).where(eq(trackingPoints.runId, id));
  await db.delete(cheers).where(eq(cheers.runId, id));
  await db.delete(runs).where(eq(runs.id, id));

  return NextResponse.json({ ok: true });
}
