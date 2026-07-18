"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

/** Instant-play launcher: creating a session and jumping straight into the
 * game — no briefing screens, no prep form. The game explains itself. */
export default function StartGamePage() {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario_id: scenarioId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't start the round");
        return;
      }
      router.replace(`/play/session/${data.session.id}`);
    })();
  }, [scenarioId, router]);

  return (
    <div className="mx-auto max-w-md pt-16 text-center">
      {error ? (
        <p className="font-bold text-rose-400">{error}</p>
      ) : (
        <>
          <div className="anim-float text-6xl drop-shadow-[0_0_24px_rgba(99,102,241,0.5)]">
            🤝
          </div>
          <p className="mt-4 font-extrabold text-stone-400">
            Taking you to the table…
          </p>
        </>
      )}
    </div>
  );
}
