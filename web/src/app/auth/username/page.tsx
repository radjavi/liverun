"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession, authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default function ChooseUsername() {
  return (
    <Suspense>
      <ChooseUsernameForm />
    </Suspense>
  );
}

function ChooseUsernameForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = useSession();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      router.replace("/auth");
    } else if (session.user.username) {
      const returnTo = searchParams.get("returnTo");
      router.replace(returnTo ?? `/${session.user.username}`);
    }
  }, [isPending, session, router]);

  if (isPending || !session?.user || session.user.username) {
    return (
      <div className="relative flex h-svh items-center justify-center">
        <div className="absolute top-0 left-0 h-0.5 w-full overflow-hidden bg-white/10 opacity-0 animate-[fade-in_0s_1s_forwards]">
          <div className="h-full w-1/3 animate-indeterminate bg-white" />
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authClient.updateUser({
        username: username.toLowerCase(),
        displayUsername: username,
      });
      if (res.error) {
        setError(res.error.message ?? "Username unavailable");
        return;
      }
      const returnTo = searchParams.get("returnTo");
      router.replace(returnTo ?? `/${username.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-svh items-center justify-center">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="space-y-1 text-center">
          <h1 className="font-mono text-2xl font-bold tracking-tight">
            Choose a username
          </h1>
          <p className="font-mono text-xs text-muted-foreground">
            This will be your public profile URL
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="text"
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
            required
            minLength={3}
            maxLength={30}
            className="font-mono"
          />

          {username && (
            <p className="font-mono text-xs text-muted-foreground">
              liverun.spcf.app/{username.toLowerCase()}
            </p>
          )}

          {error && (
            <p className="font-mono text-xs text-red-500">{error}</p>
          )}

          <Button type="submit" disabled={loading || username.length < 3} className="w-full font-mono">
            {loading ? "..." : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
