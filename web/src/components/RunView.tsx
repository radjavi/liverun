"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useShape } from "@electric-sql/react";
import { AnimatePresence, motion } from "motion/react";

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

function CountdownModal({
  name,
  plannedStartTime,
}: {
  name: string;
  plannedStartTime: string;
}) {
  const target = new Date(plannedStartTime).getTime();
  const [remaining, setRemaining] = useState(target - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(target - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [target]);

  const clamped = Math.max(0, remaining);
  const days = Math.floor(clamped / 86_400_000);
  const hours = Math.floor((clamped % 86_400_000) / 3_600_000);
  const minutes = Math.floor((clamped % 3_600_000) / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1000);

  // Show two most relevant units
  let left: string, right: string, leftLabel: string, rightLabel: string;
  if (days > 0) {
    left = String(days).padStart(2, "0");
    right = String(hours).padStart(2, "0");
    leftLabel = "DAY";
    rightLabel = "HR";
  } else if (hours > 0) {
    left = String(hours).padStart(2, "0");
    right = String(minutes).padStart(2, "0");
    leftLabel = "HR";
    rightLabel = "MIN";
  } else {
    left = String(minutes).padStart(2, "0");
    right = String(seconds).padStart(2, "0");
    leftLabel = "MIN";
    rightLabel = "SEC";
  }

  return (
      <div className="rounded-2xl border border-white/10 bg-black/80 px-16 py-6 text-center backdrop-blur-sm">
        <p className="mb-1 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {name}
        </p>
        <p className="mb-4 font-mono text-xs text-muted-foreground">
          {new Date(plannedStartTime).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}{" "}
          {new Date(plannedStartTime).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })}
        </p>
        <div className="flex items-baseline justify-center gap-1 select-none">
          <div className="flex flex-col items-center">
            <span
              className="font-mono font-light tracking-tighter leading-none text-white"
              style={{ fontSize: "clamp(4rem, 18vw, 10rem)" }}
            >
              {left}
            </span>
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {leftLabel}
            </span>
          </div>
          <span
            className="font-light leading-none text-orange-500 pb-5"
            style={{ fontSize: "clamp(3rem, 14vw, 8rem)" }}
          >
            .
          </span>
          <div className="flex flex-col items-center">
            <span
              className="font-mono font-light tracking-tighter leading-none text-white"
              style={{ fontSize: "clamp(4rem, 18vw, 10rem)" }}
            >
              {right}
            </span>
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {rightLabel}
            </span>
          </div>
        </div>
      </div>
  );
}

export default function RunView({
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
  const { data: points } = useShape<{ id: string }>({
    url: `${typeof window !== "undefined" ? window.location.origin : ""}/api/sync/points?runId=${runId}`,
  });

  type RunRow = { id: string; started_at: string | null; ended_at: string | null };
  const { data: runRows } = useShape<RunRow>({
    url: `${typeof window !== "undefined" ? window.location.origin : ""}/api/sync/runs?runId=${runId}`,
  });
  const liveStartedAt = runRows.length > 0 ? runRows[0].started_at : startedAt;
  const liveEndedAt = runRows.length > 0 ? runRows[0].ended_at : endedAt;

  const showCountdown = !!plannedStartTime && !liveStartedAt;
  const [transitioned, setTransitioned] = useState(false);
  const [countdownDone, setCountdownDone] = useState(!showCountdown);

  useEffect(() => {
    if (!showCountdown && !countdownDone) {
      setTransitioned(true);
      const timer = setTimeout(() => setCountdownDone(true), 1800);
      return () => clearTimeout(timer);
    }
    if (showCountdown) {
      setCountdownDone(false);
    }
  }, [showCountdown]);

  const showRunUI = !showCountdown && countdownDone;
  const fadeIn = transitioned ? { opacity: 0 } : false;

  return (
    <div className="flex h-svh flex-col">
      <AnimatePresence>
        {showRunUI && (
          <motion.div
            key="stats"
            initial={fadeIn}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <StatsPanel runId={runId} startedAt={liveStartedAt ?? startedAt} endedAt={liveEndedAt ?? null} />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="relative flex flex-1 overflow-hidden">
        <AnimatePresence>
          {showRunUI && (
            <motion.div
              key="sidebar"
              initial={fadeIn}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: transitioned ? 0.15 : 0 }}
            >
              <Sidebar runId={runId} />
            </motion.div>
          )}
        </AnimatePresence>
        <Map runId={runId} raceId={raceId} isPlanned={showCountdown && !countdownDone} />
        <AnimatePresence>
          {showRunUI && (
            <motion.div
              key="overlays"
              initial={fadeIn}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: transitioned ? 0.3 : 0 }}
            >
              <MobileOverlays runId={runId} />
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showCountdown && (
            <motion.div
              key="countdown"
              className="absolute inset-0 z-20 flex items-center justify-center"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 1 }}
            >
              <CountdownModal
                name={name || "Outdoor Run"}
                plannedStartTime={plannedStartTime!}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
