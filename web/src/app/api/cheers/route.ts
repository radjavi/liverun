import { NextRequest, NextResponse } from "next/server";
import { desc, eq, gt, sql } from "drizzle-orm";
import db from "@/db";
import { cheers } from "@/db/schema";

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.runId || !body.message) {
    return NextResponse.json(
      { error: "Missing required fields: runId, message" },
      { status: 400 }
    );
  }

  await db.insert(cheers).values({
    runId: body.runId as string,
    message: (body.message as string).slice(0, 100),
  });

  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("runId");
  const after = request.nextUrl.searchParams.get("after");

  if (!runId) {
    return NextResponse.json(
      { error: "Missing required param: runId" },
      { status: 400 }
    );
  }

  const conditions = [eq(cheers.runId, runId)];
  if (after) {
    conditions.push(gt(cheers.id, Number(after)));
  }

  const rows = await db
    .select()
    .from(cheers)
    .where(sql`${cheers.runId} = ${runId}${after ? sql` AND ${cheers.id} > ${Number(after)}` : sql``}`)
    .orderBy(desc(cheers.id));

  const count = rows.length;
  const highlight = count > 0 ? rows[Math.floor(Math.random() * count)] : null;
  const lastId = count > 0 ? rows[0].id : after ? Number(after) : 0;

  return NextResponse.json({
    count,
    highlight: highlight ? { id: highlight.id, message: highlight.message } : null,
    lastId,
  });
}
