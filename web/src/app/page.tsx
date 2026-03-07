"use client";

import dynamic from "next/dynamic";

const RunView = dynamic(() => import("@/components/RunView"), { ssr: false });

export default function Home() {
  return <RunView />;
}
