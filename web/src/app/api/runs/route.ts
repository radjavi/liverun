import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import db from "@/db";
import { runs } from "@/db/schema";
import { getSessionFromRequest } from "@/lib/auth-server";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let startedAt: Date | undefined;
  let endedAt: Date | undefined;
  try {
    const body = await request.json();
    if (body.startedAt) startedAt = new Date(body.startedAt);
    if (body.endedAt) endedAt = new Date(body.endedAt);
  } catch {
    // No body — use defaults
  }

  const id = nanoid();
  await db.insert(runs).values({
    id,
    userId: session.user.id,
    ...(startedAt && { startedAt }),
    ...(endedAt && { endedAt }),
  });
  return NextResponse.json({ id });
}
