import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import db from "@/db";
import { user } from "@/db/auth-schema";
import { runs } from "@/db/schema";
import RunPageClient from "./run-page-client";

export default async function RunPage({
  params,
}: {
  params: Promise<{ username: string; runId: string }>;
}) {
  const { username, runId } = await params;

  const [found] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.username, username));

  if (!found) notFound();

  const [run] = await db
    .select({
      id: runs.id,
      startedAt: runs.startedAt,
      endedAt: runs.endedAt,
    })
    .from(runs)
    .where(and(eq(runs.id, runId), eq(runs.userId, found.id)));

  if (!run) notFound();

  return (
    <RunPageClient
      runId={run.id}
      startedAt={run.startedAt.toISOString()}
      endedAt={run.endedAt?.toISOString() ?? null}
    />
  );
}
