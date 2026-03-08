"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Watch } from "lucide-react";
import DemoMap from "@/components/DemoMap";

export default function LandingPage() {
  const router = useRouter();


  return (
    <div className="relative h-svh overflow-hidden">
      {/* Animated map background */}
      <div className="absolute inset-0" style={{ zIndex: 0 }}>
        <DemoMap />
      </div>

      {/* Dim overlay */}
      <div className="absolute inset-0" style={{ zIndex: 1 }}>
        <div className="h-full w-full bg-black/75" />
      </div>

      {/* Content */}
      <div className="flex h-full flex-col items-center justify-center px-4" style={{ position: "relative", zIndex: 2 }}>
        <div className="flex flex-col items-center space-y-8">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-sm">
            <Watch className="h-4 w-4 text-white/50" />
            <span className="font-mono text-xs text-white/50">
              Coming soon for Apple Watch
            </span>
          </div>

          <div className="space-y-2 text-center">
            <h1 className="font-mono text-4xl font-bold tracking-tight text-white">
              LiveRun
            </h1>
            <p className="font-mono text-base text-white/70">
              Make your run more fun
            </p>
          </div>

          <Button
            size="lg"
            onClick={() => router.push("/auth")}
            className="font-mono text-base px-10"
          >
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
}
