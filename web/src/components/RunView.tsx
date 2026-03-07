"use client";

import dynamic from "next/dynamic";
import { useShape } from "@electric-sql/react";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });
const StatsPanel = dynamic(() => import("@/components/StatsPanel"), {
  ssr: false,
});
const Sidebar = dynamic(() => import("@/components/Sidebar"), {
  ssr: false,
});

type RunRow = {
  id: string;
  started_at: string;
  ended_at: string | null;
};

export default function RunView() {
  const { data: runs } = useShape<RunRow>({
    url: `${window.location.origin}/api/sync/runs`,
  });

  // Pick the most recently started run
  const sorted = [...runs].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  );
  const latestRun = sorted[0];

  if (!latestRun) {
    return (
      <div className="flex h-svh items-center justify-center">
        <p className="font-mono text-sm text-muted-foreground">
          No runs yet. Start a run from the Watch app.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-svh flex-col">
      <StatsPanel runId={latestRun.id} startedAt={latestRun.started_at} endedAt={latestRun.ended_at} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar runId={latestRun.id} />
        <Map runId={latestRun.id} />
      </div>
    </div>
  );
}
