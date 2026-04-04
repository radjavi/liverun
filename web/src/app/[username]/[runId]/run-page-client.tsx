"use client";

import dynamic from "next/dynamic";

const RunView = dynamic(() => import("@/components/RunView"), { ssr: false });

export default function RunPageClient({
  runId,
  name,
  startedAt,
  endedAt,
  raceId,
  plannedStartTime,
}: {
  runId: string;
  name: string | null;
  startedAt: string | null;
  endedAt: string | null;
  raceId: string | null;
  plannedStartTime: string | null;
}) {
  return (
    <RunView
      runId={runId}
      name={name}
      startedAt={startedAt}
      endedAt={endedAt}
      raceId={raceId}
      plannedStartTime={plannedStartTime}
    />
  );
}
