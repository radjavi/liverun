"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useShape } from "@electric-sql/react";
import { useSession, signOut } from "@/lib/auth-client";

type RunRow = {
  id: string;
  user_id: string | null;
  started_at: string;
  ended_at: string | null;
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

  const sorted = [...runs].sort(
    (a, b) =>
      new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
  );

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

      <h2 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Runs
      </h2>

      {sorted.length === 0 ? (
        <p className="font-mono text-sm text-muted-foreground">
          No runs yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((run) => (
            <Link
              key={run.id}
              href={`/${displayUsername.toLowerCase()}/${run.id}`}
              className="flex items-center justify-between rounded-md border px-4 py-3 hover:bg-accent transition-colors"
            >
              <span className="font-mono text-sm">
                {new Date(run.started_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <div className="flex items-center gap-2">
                {!run.ended_at && (
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                )}
                <span className="font-mono text-xs text-muted-foreground">
                  {new Date(run.started_at).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
