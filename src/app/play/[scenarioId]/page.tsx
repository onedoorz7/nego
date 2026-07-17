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
        <p className="text-rose-600">{error}</p>
      ) : (
        <>
          <div className="animate-bounce text-5xl">🤝</div>
          <p className="mt-3 font-semibold text-stone-500">
            Taking you to the table…
          </p>
        </>
      )}
    </div>
  );
}
