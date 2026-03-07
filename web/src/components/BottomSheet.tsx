"use client";

import { useState, useRef, useEffect } from "react";
import { useShape } from "@electric-sql/react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { List, X } from "lucide-react";
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
  cadence: string | null;
  grade_adjusted_pace: string | null;
  recorded_at: string;
  created_at: string;
};

type Split = {
  km: number;
  partial: boolean;
  paceSeconds: number;
  elevChange: number;
  avgHr: number | null;
};

function formatSplitPace(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function computeSplits(points: PointRow[]): Split[] {
  if (points.length < 2) return [];

  const sorted = [...points].sort(
    (a, b) =>
      new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
  );

  const splits: Split[] = [];
  let splitStartIdx = 0;
  let nextKmBoundary = 1000;

  for (let i = 1; i < sorted.length; i++) {
    const dist = Number(sorted[i].distance_meters ?? 0);

    if (dist >= nextKmBoundary) {
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

  const lastPoint = sorted[sorted.length - 1];
  const lastDist = Number(lastPoint.distance_meters ?? 0);
  const partialDist = lastDist - (nextKmBoundary - 1000);

  if (partialDist > 0) {
    const startTime = new Date(sorted[splitStartIdx].recorded_at).getTime();
    const endTime = new Date(lastPoint.recorded_at).getTime();
    const splitSeconds = (endTime - startTime) / 1000;
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

export default function MobileOverlays({ runId }: { runId: string }) {
  const [cheersOpen, setCheersOpen] = useState(false);
  const [splitsOpen, setSplitsOpen] = useState(false);
  const cheersInputRef = useRef<HTMLDivElement>(null);

  const { data: allPoints } = useShape<PointRow>({
    url: `${window.location.origin}/api/sync/points`,
  });

  const points = allPoints
    .filter((p) => p.run_id === runId)
    .sort(
      (a, b) =>
        new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    );

  const splits = computeSplits(points);
  const allPaces = splits.map((s) => s.paceSeconds);
  const minPace = Math.min(...allPaces);
  const maxPace = Math.max(...allPaces);

  useEffect(() => {
    if (cheersOpen) {
      setTimeout(() => {
        const textarea = cheersInputRef.current?.querySelector("textarea");
        textarea?.focus();
      }, 100);
    }
  }, [cheersOpen]);

  return (
    <div className="lg:hidden">
      {/* Splits button - top left below stats */}
      <button
        onClick={() => {
          setSplitsOpen((o) => !o);
          setCheersOpen(false);
        }}
        className="absolute top-2 left-2 z-40 flex h-10 w-10 items-center justify-center rounded-md bg-background/90 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Toggle splits"
      >
        <List size={18} />
      </button>

      {/* Cheer button - bottom center */}
      <AnimatePresence>
        {!cheersOpen && (
          <motion.button
            onClick={() => {
              setCheersOpen(true);
              setSplitsOpen(false);
            }}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 z-40 flex h-10 px-10 items-center justify-center rounded-md bg-background/90 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            Cheer
          </motion.button>
        )}
      </AnimatePresence>

      {/* Splits overlay */}
      <AnimatePresence>
        {splitsOpen && (
          <motion.div
            className="absolute inset-0 z-50 flex pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.div
              className="w-60 sm:w-72 bg-background/95 flex flex-col pointer-events-auto"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              <div className="flex items-center justify-between p-4">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Splits
                </span>
                <button
                  onClick={() => setSplitsOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Close splits"
                >
                  <X size={16} />
                </button>
              </div>
              <ScrollArea className="flex-1">
                <div className="px-3 pb-3 sm:px-4 sm:pb-4">
                  {splits.length === 0 ? (
                    <p className="font-mono text-xs text-muted-foreground/60">
                      No splits yet
                    </p>
                  ) : (
                    <div>
                      <div className="flex items-center gap-1.5 sm:gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        <span className="w-6 sm:w-7 text-right">Km</span>
                        <span className="w-9 sm:w-10 text-right">Pace</span>
                        <span className="flex-1" />
                        <span className="w-7 sm:w-8 text-right">Elev</span>
                        <span className="w-7 sm:w-8 text-right">HR</span>
                      </div>
                      <Separator className="my-1.5 sm:my-2" />
                      <div className="flex flex-col gap-0.5 sm:gap-1">
                        {splits.map((split, i) => {
                          const barPercent =
                            maxPace === minPace
                              ? 80
                              : 20 +
                                ((maxPace - split.paceSeconds) /
                                  (maxPace - minPace)) *
                                  80;
                          return (
                            <div
                              key={i}
                              className="flex items-center gap-1.5 sm:gap-2 font-mono text-xs tabular-nums"
                            >
                              <span className="w-6 sm:w-7 text-right text-muted-foreground">
                                {split.partial
                                  ? `.${split.km.toString().split(".")[1] ?? "0"}`
                                  : split.km}
                              </span>
                              <span className="w-9 sm:w-10 text-right text-muted-foreground">
                                {formatSplitPace(split.paceSeconds)}
                              </span>
                              <div className="flex-1 -mt-[1.5px] overflow-hidden font-mono text-[8px] sm:text-[10px] leading-none tracking-[0.05em] sm:tracking-[0.1em] text-primary/75">
                                {"\u2588".repeat(
                                  Math.round((barPercent / 100) * 8),
                                )}
                              </div>
                              <span className="w-7 sm:w-8 text-right text-muted-foreground">
                                {split.elevChange > 0
                                  ? `${split.elevChange}`
                                  : `${split.elevChange}`}
                              </span>
                              <span className="w-7 sm:w-8 text-right text-muted-foreground">
                                {split.avgHr ?? "\u2014"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </motion.div>
            <div className="flex-1" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cheers overlay */}
      <AnimatePresence>
        {cheersOpen && (
          <motion.div
            className="absolute inset-0 z-50 flex flex-col [mask-image:linear-gradient(to_top,black_0px,black_165px,transparent_250px)] backdrop-blur-xs"
            initial={{ opacity: 0, pointerEvents: "none" as const }}
            animate={{ opacity: 1, pointerEvents: "auto" as const }}
            exit={{ opacity: 0, pointerEvents: "none" as const }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            onClick={() => setCheersOpen(false)}
          >
            <div className="flex-1" />
            <div className="pt-16">
              <motion.div
                className="mx-auto w-full max-w-sm px-3 pb-3"
                ref={cheersInputRef}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 30 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                onClick={(e) => e.stopPropagation()}
              >
                <CheerSection runId={runId} />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
