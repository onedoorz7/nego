"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ResetButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const reset = async (wipe: boolean) => {
    if (!confirm(wipe ? "Reset progress AND delete all session data?" : "Reset progress (XP, unlocks, bests)?")) return;
    setBusy(true);
    try {
      await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wipe ? { wipe: "all" } : {}),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => reset(false)}
        disabled={busy}
        className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-2 font-semibold text-amber-300 hover:bg-amber-400/20 disabled:opacity-40"
      >
        ♻️ Reset progress
      </button>
      <button
        onClick={() => reset(true)}
        disabled={busy}
        className="rounded-lg border border-rose-400/40 bg-rose-400/10 px-4 py-2 font-semibold text-rose-300 hover:bg-rose-400/20 disabled:opacity-40"
      >
        🗑️ Wipe everything
      </button>
    </>
  );
}
