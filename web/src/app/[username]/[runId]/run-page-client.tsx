"use client";

import dynamic from "next/dynamic";

const RunView = dynamic(() => import("@/components/RunView"), { ssr: false });

export default function RunPageClient({
  runId,
  startedAt,
  endedAt,
}: {
  runId: string;
  startedAt: string;
  endedAt: string | null;
}) {
  return <RunView runId={runId} startedAt={startedAt} endedAt={endedAt} />;
}
