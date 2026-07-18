"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Daily-challenge launcher: one seeded table per day, one attempt. */
export default function StartDailyPage() {
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
        body: JSON.stringify({ daily: true }),
      });
      const data = await res.json();
      if (res.status === 409 && data.session_id) {
        // Already played — jump to today's result instead.
        router.replace(`/play/session/${data.session_id}/result`);
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Couldn't start today's table");
        return;
      }
      router.replace(`/play/session/${data.session.id}`);
    })();
  }, [router]);

  return (
    <div className="mx-auto max-w-md pt-16 text-center">
      {error ? (
        <p className="text-rose-600">{error}</p>
      ) : (
        <>
          <div className="animate-bounce text-5xl">📅</div>
          <p className="mt-3 font-semibold text-stone-500">
            Dealing today&apos;s table…
          </p>
        </>
      )}
    </div>
  );
}
