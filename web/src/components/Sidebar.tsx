"use client";

import dynamic from "next/dynamic";
import { useShape } from "@electric-sql/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const CheerSection = dynamic(() => import("@/components/CheerBar"), {
  ssr: false,
});

type PointRow = {
  id: string;
  run_id: string;
  latitude: string;
  longitude: string;
  altitude: string | null;
  heart_rate: string | null;
  pace: string | null;
  distance_meters: string | null;
  recorded_at: string;
};

type Split = {
  km: number;
  partial: boolean;
  paceSeconds: number;
  elevChange: number;
  avgHr: number | null;
};

function computeSplits(points: PointRow[]): Split[] {
  if (points.length < 2) return [];

  const sorted = [...points].sort(
    (a, b) =>
      new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
  );

  const splits: Split[] = [];
  let splitStartIdx = 0;
  let nextKmBoundary = 1000; // meters

  for (let i = 1; i < sorted.length; i++) {
    const dist = Number(sorted[i].distance_meters ?? 0);

    if (dist >= nextKmBoundary) {
      // Interpolate the exact time at the km boundary
      const prevDist = Number(sorted[i - 1].distance_meters ?? 0);
      const prevTime = new Date(sorted[i - 1].recorded_at).getTime();
      const currTime = new Date(sorted[i].recorded_at).getTime();
      const fraction = (nextKmBoundary - prevDist) / (dist - prevDist);
      const boundaryTime = prevTime + fraction * (currTime - prevTime);

      const startTime =
        splitStartIdx === 0
          ? new Date(sorted[0].recorded_at).getTime()
          : new Date(sorted[splitStartIdx].recorded_at).getTime();

      const splitSeconds = (boundaryTime - startTime) / 1000;

      // Collect altitude and HR from points in this segment
      const segmentPoints = sorted.slice(splitStartIdx, i + 1);
      const altitudes = segmentPoints
        .map((p) => (p.altitude != null ? Number(p.altitude) : null))
        .filter((a): a is number => a !== null);
      const hrs = segmentPoints
        .map((p) => (p.heart_rate != null ? Number(p.heart_rate) : null))
        .filter((h): h is number => h !== null && h > 0);

      const elevChange =
        altitudes.length >= 2
          ? altitudes[altitudes.length - 1] - altitudes[0]
          : 0;
      const avgHr =
        hrs.length > 0
          ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length)
          : null;

      splits.push({
        km: nextKmBoundary / 1000,
        partial: false,
        paceSeconds: splitSeconds,
        elevChange: Math.round(elevChange),
        avgHr,
      });

      splitStartIdx = i;
      nextKmBoundary += 1000;
    }
  }

  // Partial last split
  const lastPoint = sorted[sorted.length - 1];
  const lastDist = Number(lastPoint.distance_meters ?? 0);
  const partialDist = lastDist - (nextKmBoundary - 1000);

  if (partialDist > 0) {
    const startTime = new Date(sorted[splitStartIdx].recorded_at).getTime();
    const endTime = new Date(lastPoint.recorded_at).getTime();
    const splitSeconds = (endTime - startTime) / 1000;
    // Normalize to per-km pace
    const paceSeconds = splitSeconds / (partialDist / 1000);

    const segmentPoints = sorted.slice(splitStartIdx);
    const altitudes = segmentPoints
      .map((p) => (p.altitude != null ? Number(p.altitude) : null))
      .filter((a): a is number => a !== null);
    const hrs = segmentPoints
      .map((p) => (p.heart_rate != null ? Number(p.heart_rate) : null))
      .filter((h): h is number => h !== null && h > 0);

    const elevChange =
      altitudes.length >= 2
        ? altitudes[altitudes.length - 1] - altitudes[0]
        : 0;
    const avgHr =
      hrs.length > 0
        ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length)
        : null;

    splits.push({
      km: parseFloat((partialDist / 1000).toFixed(2)),
      partial: true,
      paceSeconds,
      elevChange: Math.round(elevChange),
      avgHr,
    });
  }

  return splits;
}

function formatPace(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function Sidebar({ runId }: { runId: string }) {
  const { data: allPoints } = useShape<PointRow>({
    url: `${window.location.origin}/api/sync/points`,
  });

  const points = allPoints.filter((p) => p.run_id === runId);
  const splits = computeSplits(points);

  // For bar width scaling: fastest pace = widest bar
  const allPaces = splits.map((s) => s.paceSeconds);
  const minPace = Math.min(...allPaces);
  const maxPace = Math.max(...allPaces);

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <ScrollArea className="flex-1">
        <div className="p-4 pt-0">
          {splits.length === 0 ? (
            <>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Splits
              </span>
              <p className="mt-2 font-mono text-xs text-muted-foreground/60">
                No splits yet
              </p>
            </>
          ) : (
            <div>
              {/* Header */}
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <span className="w-7 text-right">Km</span>
                <span className="w-10 text-right">Pace</span>
                <span className="flex-1" />
                <span className="w-8 text-right">Elev</span>
                <span className="w-8 text-right">HR</span>
              </div>
              <Separator className="my-2" />

              {/* Rows */}
              <div className="flex flex-col gap-1">
                {splits.map((split, i) => {
                  // Bar width: fastest = 100%, slowest = 20%
                  const barPercent =
                    maxPace === minPace
                      ? 80
                      : 20 +
                        ((maxPace - split.paceSeconds) / (maxPace - minPace)) *
                          80;

                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 font-mono text-xs tabular-nums"
                    >
                      <span className="w-7 text-right text-muted-foreground">
                        {split.partial
                          ? `.${split.km.toString().split(".")[1] ?? "0"}`
                          : split.km}
                      </span>
                      <span className="w-10 text-right text-muted-foreground">
                        {formatPace(split.paceSeconds)}
                      </span>
                      <div className="flex-1 -mt-[1.5px] overflow-hidden font-mono text-[10px] leading-none tracking-[0.1em] text-primary/75">
                        {"█".repeat(Math.round((barPercent / 100) * 12))}
                      </div>
                      <span className="w-8 text-right text-muted-foreground">
                        {split.elevChange > 0
                          ? `${split.elevChange}`
                          : `${split.elevChange}`}
                      </span>
                      <span className="w-8 text-right text-muted-foreground">
                        {split.avgHr ?? "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4">
        <CheerSection runId={runId} />
      </div>
    </div>
  );
}
