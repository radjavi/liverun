"use client";

import dynamic from "next/dynamic";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });
const StatsPanel = dynamic(() => import("@/components/StatsPanel"), {
  ssr: false,
});
const Sidebar = dynamic(() => import("@/components/Sidebar"), {
  ssr: false,
});
const MobileOverlays = dynamic(() => import("@/components/BottomSheet"), {
  ssr: false,
});

export default function RunView({
  runId,
  startedAt,
  endedAt,
}: {
  runId: string;
  startedAt: string;
  endedAt: string | null;
}) {
  return (
    <div className="flex h-svh flex-col">
      <StatsPanel runId={runId} startedAt={startedAt} endedAt={endedAt} />
      <div className="relative flex flex-1 overflow-hidden">
        <Sidebar runId={runId} />
        <Map runId={runId} />
        <MobileOverlays runId={runId} />
      </div>
    </div>
  );
}
