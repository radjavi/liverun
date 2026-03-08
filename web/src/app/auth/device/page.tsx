"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default function DeviceVerification() {
  return (
    <Suspense>
      <DeviceVerificationForm />
    </Suspense>
  );
}

function DeviceVerificationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = useSession();
  const [userCode, setUserCode] = useState(searchParams.get("user_code") ?? "");
  const [status, setStatus] = useState<"idle" | "approving" | "approved" | "denied" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const code = searchParams.get("user_code");
    if (code) setUserCode(code);
  }, [searchParams]);

  if (isPending) {
    return (
      <div className="relative flex h-svh items-center justify-center">
        <div className="absolute top-0 left-0 h-0.5 w-full overflow-hidden bg-white/10 opacity-0 animate-[fade-in_0s_1s_forwards]">
          <div className="h-full w-1/3 animate-indeterminate bg-white" />
        </div>
      </div>
    );
  }

  if (!session?.user) {
    const returnUrl = `/auth/device${userCode ? `?user_code=${userCode}` : ""}`;
    router.replace(`/auth?returnTo=${encodeURIComponent(returnUrl)}`);
    return null;
  }

  async function handleApprove() {
    setStatus("approving");
    setError("");
    try {
      const res = await fetch("/api/auth/device/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userCode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? "Verification failed");
        setStatus("error");
        return;
      }
      setStatus("approved");
    } catch {
      setError("Verification failed");
      setStatus("error");
    }
  }

  if (status === "approved") {
    return (
      <div className="flex h-svh items-center justify-center">
        <div className="space-y-2 text-center">
          <p className="font-mono text-lg font-bold">Device authorized</p>
          <p className="font-mono text-xs text-muted-foreground">
            You can close this page and return to your watch.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-svh items-center justify-center">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="space-y-1 text-center">
          <h1 className="font-mono text-2xl font-bold tracking-tight">
            Authorize device
          </h1>
          <p className="font-mono text-xs text-muted-foreground">
            Enter the code shown on your watch
          </p>
        </div>

        <div className="space-y-3">
          <Input
            type="text"
            placeholder="Device code"
            value={userCode}
            onChange={(e) => setUserCode(e.target.value.toUpperCase())}
            className="font-mono text-center tracking-widest"
          />

          {error && (
            <p className="font-mono text-xs text-red-500">{error}</p>
          )}

          <Button onClick={handleApprove} disabled={!userCode || status === "approving"} className="w-full font-mono">
            {status === "approving" ? "..." : "Authorize"}
          </Button>
        </div>
      </div>
    </div>
  );
}
