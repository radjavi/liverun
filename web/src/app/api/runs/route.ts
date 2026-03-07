import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import db from "@/db";
import { runs } from "@/db/schema";

export async function POST() {
  const id = nanoid();
  await db.insert(runs).values({ id });
  return NextResponse.json({ id });
}
