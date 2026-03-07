"use client";

import { useState, useEffect } from "react";
import { useShape } from "@electric-sql/react";

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

function formatPace(minPerKm: number): string {
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function StatsPanel({ runId, startedAt, endedAt }: { runId: string; startedAt: string; endedAt: string | null }) {
  const { data: allPoints, isError } = useShape<PointRow>({
    url: `${window.location.origin}/api/sync/points`,
  });

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    if (endedAt) {
      setElapsed(Math.floor((new Date(endedAt).getTime() - start) / 1000));
      return;
    }
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, endedAt]);

  const points = allPoints
    .filter((p) => p.run_id === runId)
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
  const latest = points.length > 0 ? points[points.length - 1] : null;

  const hr = latest?.heart_rate ? Number(latest.heart_rate) : null;
  const pace = latest?.pace ? Number(latest.pace) : null;
  const distance = latest?.distance_meters
    ? (Number(latest.distance_meters) / 1000).toFixed(2)
    : null;
  const gap = latest?.grade_adjusted_pace ? Number(latest.grade_adjusted_pace) : null;
  const cadence = latest?.cadence ? Number(latest.cadence) : null;
  const altitude = latest?.altitude ? Number(latest.altitude) : null;

  return (
    <div className="flex items-center gap-4 px-4 py-3 lg:gap-8 lg:px-6 lg:py-4">
      <Stat label="Time" value={formatDuration(elapsed)} unit="" />
      <Stat label="Distance" value={distance ?? "\u2014"} unit="km" />
      <Stat label="HR" value={hr ? `${hr}` : "\u2014"} unit="bpm" />
      <Stat
        label="Pace"
        value={pace ? formatPace(pace) : "\u2014"}
        unit="/km"
      />
      <div className="hidden sm:flex"><Stat label="GAP" value={gap ? formatPace(gap) : "\u2014"} unit="/km" /></div>
      <div className="hidden sm:flex"><Stat label="Cadence" value={cadence ? `${cadence}` : "\u2014"} unit="spm" /></div>
      <div className="hidden sm:flex"><Stat label="Altitude" value={altitude != null ? `${Math.round(altitude)}` : "\u2014"} unit="m" /></div>

      <div className="ml-auto flex items-center gap-1.5">
        <span className={`inline-block h-2 w-2 rounded-full ${isError || endedAt ? "bg-red-500" : "bg-green-500 animate-pulse"}`} />
        <span className="hidden lg:inline font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {isError ? "Disconnected" : endedAt ? "Disconnected" : "Connected"}
        </span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-lg tabular-nums">
        {value}
        {value !== "\u2014" && (
          <span className="ml-1 text-xs text-muted-foreground">{unit}</span>
        )}
      </span>
    </div>
  );
}
