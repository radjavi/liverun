"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useSession, signIn, signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default function AuthPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session?.user) {
      const returnTo = searchParams.get("returnTo");
      if (!session.user.username) {
        const params = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
        router.replace(`/auth/username${params}`);
      } else if (returnTo) {
        router.replace(returnTo);
      } else {
        router.replace(`/${session.user.username}`);
      }
    }
  }, [session, router, searchParams]);

  if (isPending || session?.user) {
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
      if (mode === "signup") {
        const res = await signUp.email({ email, password, name });
        if (res.error) {
          setError(res.error.message ?? "Sign up failed");
          return;
        }
      } else {
        const res = await signIn.email({ email, password });
        if (res.error) {
          setError(res.error.message ?? "Sign in failed");
          return;
        }
      }
    } finally {
      setLoading(false);
    }
  }

  function handleGoogle() {
    const returnTo = searchParams.get("returnTo");
    signIn.social({ provider: "google", callbackURL: returnTo ?? "/auth/username" });
  }

  return (
    <div className="flex h-svh items-center justify-center">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="space-y-1 text-center">
          <h1 className="font-mono text-2xl font-bold tracking-tight">
            LiveRun
          </h1>
          <p className="font-mono text-xs text-muted-foreground">
            {mode === "signin" ? "Sign in to your account" : "Create your account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <Input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="font-mono"
            />
          )}
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="font-mono"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="font-mono"
          />

          {error && (
            <p className="font-mono text-xs text-red-500">{error}</p>
          )}

          <Button type="submit" disabled={loading} className="w-full font-mono">
            {loading
              ? "..."
              : mode === "signin"
                ? "Sign in"
                : "Sign up"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-2 font-mono text-xs text-muted-foreground">
              or
            </span>
          </div>
        </div>

        <Button variant="outline" onClick={handleGoogle} className="w-full font-mono">
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Sign in with Google
        </Button>

        <p className="text-center font-mono text-xs text-muted-foreground">
          {mode === "signin" ? (
            <>
              No account?{" "}
              <Button
                variant="link"
                onClick={() => {
                  setMode("signup");
                  setError("");
                }}
                className="h-auto p-0 font-mono text-xs text-muted-foreground underline hover:text-foreground"
              >
                Sign up
              </Button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Button
                variant="link"
                onClick={() => {
                  setMode("signin");
                  setError("");
                }}
                className="h-auto p-0 font-mono text-xs text-muted-foreground underline hover:text-foreground"
              >
                Sign in
              </Button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
