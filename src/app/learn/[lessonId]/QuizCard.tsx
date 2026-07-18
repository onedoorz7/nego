"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface QuizItem {
  question: string;
  choices: string[];
}

interface GradeResult {
  passed: boolean;
  score: number;
  total: number;
  results: { correct: boolean; answer_index: number; explanation: string }[];
}

export default function QuizCard({
  lessonId,
  scenarioId,
  quiz,
}: {
  lessonId: string;
  scenarioId: string | null;
  quiz: QuizItem[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<(number | null)[]>(quiz.map(() => null));
  const [result, setResult] = useState<GradeResult | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/lessons/${lessonId}/quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      setResult(data);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const retry = () => {
    setAnswers(quiz.map(() => null));
    setResult(null);
  };

  return (
    <section className="panel mt-4 p-6" style={{ animationDelay: "240ms" }}>
      <h2 className="mb-4 text-[11px] font-black uppercase tracking-[0.15em] text-stone-500">
        ✅ Quick check
      </h2>
      <div className="space-y-6">
        {quiz.map((q, qi) => {
          const graded = result?.results[qi];
          return (
            <div key={qi}>
              <p className="font-bold text-stone-200">
                {qi + 1}. {q.question}
              </p>
              <div className="mt-2 space-y-1.5">
                {q.choices.map((choice, ci) => {
                  const selected = answers[qi] === ci;
                  let cls =
                    "border-white/10 bg-white/5 text-stone-300 hover:border-indigo-400/50 hover:bg-indigo-400/10";
                  if (result && graded) {
                    if (ci === graded.answer_index)
                      cls = "border-emerald-400/50 bg-emerald-400/15 text-emerald-100";
                    else if (selected && !graded.correct)
                      cls = "border-rose-400/50 bg-rose-400/15 text-rose-100";
                    else cls = "border-white/10 bg-white/5 text-stone-500 opacity-60";
                  } else if (selected) {
                    cls = "border-indigo-400/70 bg-indigo-500/25 text-white";
                  }
                  return (
                    <button
                      key={ci}
                      type="button"
                      disabled={!!result}
                      onClick={() =>
                        setAnswers((a) => a.map((v, i) => (i === qi ? ci : v)))
                      }
                      className={`block w-full rounded-xl border px-4 py-2.5 text-left text-sm font-semibold transition active:scale-[0.99] ${cls}`}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>
              {result && graded && (
                <p
                  className={`anim-pop mt-2 rounded-lg px-3 py-2 text-sm font-medium ${
                    graded.correct
                      ? "bg-emerald-400/10 text-emerald-200"
                      : "bg-rose-400/10 text-rose-200"
                  }`}
                >
                  {graded.correct ? "Correct. " : "Not quite. "}
                  {graded.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {!result ? (
          <button
            onClick={submit}
            disabled={busy || answers.some((a) => a === null)}
            className="btn3d btn3d-indigo px-6 py-3 text-sm"
          >
            {busy ? "Checking…" : "CHECK ANSWERS"}
          </button>
        ) : result.passed ? (
          <>
            <span className="font-extrabold text-emerald-300">
              🎉 Passed ({result.score}/{result.total})
            </span>
            {scenarioId ? (
              <Link
                href={`/play/${scenarioId}`}
                className="btn3d btn3d-indigo px-6 py-3 text-sm"
              >
                PRACTICE IT LIVE →
              </Link>
            ) : (
              <Link href="/learn" className="btn3d btn3d-ghost px-6 py-3 text-sm">
                Next lesson →
              </Link>
            )}
          </>
        ) : (
          <>
            <span className="font-extrabold text-rose-300">
              {result.score}/{result.total} — review and retry
            </span>
            <button onClick={retry} className="btn3d btn3d-ghost px-6 py-3 text-sm">
              Try again
            </button>
          </>
        )}
      </div>
    </section>
  );
}
