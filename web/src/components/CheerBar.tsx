"use client";

import { useState } from "react";
import { useShape } from "@electric-sql/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  InputGroup,
  InputGroupTextarea,
  InputGroupAddon,
  InputGroupText,
  InputGroupButton,
} from "@/components/ui/input-group";

const QUICK_CHEERS = [
  { emoji: "\u{1F525}", label: "Fire" },
  { emoji: "\u{1F4AA}", label: "Strong" },
  { emoji: "\u{1F3C3}", label: "Runner" },
  { emoji: "\u{26A1}", label: "Lightning" },
  { emoji: "\u{1F389}", label: "Party" },
  { emoji: "\u{2764}\u{FE0F}", label: "Heart" },
];

type CheerRow = {
  id: string;
  run_id: string;
  message: string;
  created_at: string;
};

export default function CheerSection({ runId }: { runId: string }) {
  const [customText, setCustomText] = useState("");
  const [sending, setSending] = useState(false);

  const { data: allCheers } = useShape<CheerRow>({
    url: `${window.location.origin}/api/sync/cheers`,
  });

  const cheerCount = allCheers.filter((c) => c.run_id === runId).length;

  async function sendCheer(message: string) {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      await fetch("/api/cheers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, message: message.trim() }),
      });
      setCustomText("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Separator />
      <div className="flex items-center justify-between px-1">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Cheer
        </span>
        {cheerCount > 0 && (
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {cheerCount}
          </span>
        )}
      </div>

      <div className="grid grid-cols-6 gap-1.5">
        {QUICK_CHEERS.map((c) => (
          <Button
            key={c.label}
            variant="ghost"
            size="icon-sm"
            onClick={() => sendCheer(c.emoji)}
            disabled={sending}
            className="text-lg hover:scale-110 active:scale-95"
            title={c.label}
          >
            {c.emoji}
          </Button>
        ))}
      </div>

      <InputGroup>
        <InputGroupTextarea
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="Send a cheer..."
          maxLength={100}
          rows={2}
          className="font-mono text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendCheer(customText);
            }
          }}
        />
        <InputGroupAddon align="block-end">
          <InputGroupText className="font-mono text-[10px]">
            {customText.length}/100
          </InputGroupText>
          <InputGroupButton
            variant="outline"
            size="sm"
            className="ml-auto font-mono text-xs"
            disabled={!customText.trim() || sending}
            onClick={() => sendCheer(customText)}
          >
            Send
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
