import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import db from "@/db";
import { runs } from "@/db/schema";
import { getSessionFromRequest } from "@/lib/auth-server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [run] = await db
    .select({ userId: runs.userId })
    .from(runs)
    .where(eq(runs.id, id));

  if (!run || run.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let endedAt = new Date();
  try {
    const body = await request.json();
    if (body.endedAt) endedAt = new Date(body.endedAt);
  } catch {
    // No body — use now
  }

  await db
    .update(runs)
    .set({ endedAt })
    .where(eq(runs.id, id));

  return NextResponse.json({ ok: true });
}
