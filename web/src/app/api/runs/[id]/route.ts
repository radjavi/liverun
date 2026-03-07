import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import db from "@/db";
import { runs } from "@/db/schema";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db
    .update(runs)
    .set({ endedAt: new Date() })
    .where(eq(runs.id, id));
  return NextResponse.json({ ok: true });
}
