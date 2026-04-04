"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useShape } from "@electric-sql/react";
import { useSession, signOut } from "@/lib/auth-client";

type RunRow = {
  id: string;
  user_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  name: string | null;
  race_id: string | null;
  planned_start_time: string | null;
};

type Race = {
  id: string;
  name: string;
};

export default function ProfileClient({
  userId,
  name,
  image,
  displayUsername,
}: {
  userId: string;
  name: string;
  image: string | null;
  displayUsername: string;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const isOwnProfile = session?.user?.id === userId;

  const { data: runs } = useShape<RunRow>({
    url: `${window.location.origin}/api/sync/runs?userId=${userId}`,
  });

  const [races, setRaces] = useState<Race[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formRaceId, setFormRaceId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOwnProfile) return;
    fetch("/api/races")
      .then((res) => res.json())
      .then((data: Race[]) => setRaces(data))
      .catch(() => {});
  }, [isOwnProfile]);

  const sorted = [...runs]
    .map((r) => ({
      id: r.id,
      name: r.name,
      time: new Date(r.planned_start_time || r.started_at || Date.now()),
      isPlanned: !!r.planned_start_time && !r.started_at,
      isLive: !!r.started_at && !r.ended_at,
    }))
    .sort((a, b) => b.time.getTime() - a.time.getTime());

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName || "Outdoor Run",
          plannedStartTime: new Date(formTime).toISOString(),
          ...(formRaceId && { raceId: formRaceId }),
        }),
      });
      setFormName("");
      setFormTime("");
      setFormRaceId("");
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/runs/${id}`, { method: "DELETE" });
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-8 flex items-center gap-4">
        {image ? (
          <img
            src={image}
            alt={name}
            className="h-12 w-12 rounded-full"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted font-mono text-lg">
            {name[0]?.toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <h1 className="font-mono text-lg font-bold">{name}</h1>
          <p className="font-mono text-xs text-muted-foreground">
            @{displayUsername}
          </p>
        </div>
        {isOwnProfile && (
          <button
            onClick={async () => {
              await signOut();
              router.replace("/");
            }}
            className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        )}
      </div>

      {isOwnProfile && (
        <div className="mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className="font-mono text-sm font-medium text-foreground hover:text-muted-foreground transition-colors"
          >
            {showForm ? "Cancel" : "+ Plan a Run"}
          </button>

          {showForm && (
            <form onSubmit={handleCreate} className="mt-3 flex flex-col gap-3 rounded-md border p-4">
              <input
                type="text"
                placeholder="Outdoor Run"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="rounded-md border bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-1 focus:ring-foreground"
              />
              <input
                type="datetime-local"
                required
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                className="rounded-md border bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-1 focus:ring-foreground"
              />
              {races.length > 0 && (
                <select
                  value={formRaceId}
                  onChange={(e) => setFormRaceId(e.target.value)}
                  className="rounded-md border bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-1 focus:ring-foreground"
                >
                  <option value="">No race</option>
                  {races.map((race) => (
                    <option key={race.id} value={race.id}>
                      {race.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="submit"
                disabled={submitting || !formTime}
                className="rounded-md bg-foreground px-4 py-2 font-mono text-sm text-background hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create"}
              </button>
            </form>
          )}
        </div>
      )}

      <h2 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Runs
      </h2>

      {sorted.length === 0 ? (
        <p className="font-mono text-sm text-muted-foreground">
          No runs yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2"
            >
              <Link
                href={`/${displayUsername.toLowerCase()}/${item.id}`}
                className={`flex flex-1 items-center justify-between rounded-md border px-4 py-3 transition-colors hover:bg-accent ${item.isPlanned ? "border-dashed" : ""}`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-sm">
                    {item.name || "Outdoor Run"}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {item.time.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {item.isPlanned && (
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Planned
                    </span>
                  )}
                  {item.isLive && (
                    <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  )}
                  <span className="font-mono text-xs text-muted-foreground">
                    {item.time.toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </Link>
              {isOwnProfile && (
                <button
                  onClick={() => handleDelete(item.id)}
                  className="rounded-md p-2 text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete run"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
