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

  const id = nanoid();
  await db.insert(runs).values({ id, userId: session.user.id });
  return NextResponse.json({ id });
}
