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
    <section className="mt-4 rounded-xl border border-stone-200 bg-white p-6">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-stone-500">
        ✅ Quick check
      </h2>
      <div className="space-y-6">
        {quiz.map((q, qi) => {
          const graded = result?.results[qi];
          return (
            <div key={qi}>
              <p className="font-medium">
                {qi + 1}. {q.question}
              </p>
              <div className="mt-2 space-y-1.5">
                {q.choices.map((choice, ci) => {
                  const selected = answers[qi] === ci;
                  let cls =
                    "border-stone-200 hover:border-indigo-300 hover:bg-indigo-50/50";
                  if (result && graded) {
                    if (ci === graded.answer_index)
                      cls = "border-emerald-300 bg-emerald-50";
                    else if (selected && !graded.correct)
                      cls = "border-rose-300 bg-rose-50";
                    else cls = "border-stone-200 opacity-60";
                  } else if (selected) {
                    cls = "border-indigo-400 bg-indigo-50";
                  }
                  return (
                    <button
                      key={ci}
                      type="button"
                      disabled={!!result}
                      onClick={() =>
                        setAnswers((a) => a.map((v, i) => (i === qi ? ci : v)))
                      }
                      className={`block w-full rounded-lg border px-4 py-2.5 text-left text-sm transition ${cls}`}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>
              {result && graded && (
                <p
                  className={`mt-2 rounded-md px-3 py-2 text-sm ${
                    graded.correct
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-rose-50 text-rose-800"
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

      <div className="mt-6 flex items-center gap-3">
        {!result ? (
          <button
            onClick={submit}
            disabled={busy || answers.some((a) => a === null)}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            {busy ? "Checking…" : "Check answers"}
          </button>
        ) : result.passed ? (
          <>
            <span className="font-semibold text-emerald-700">
              🎉 Passed ({result.score}/{result.total})
            </span>
            {scenarioId ? (
              <Link
                href={`/play/${scenarioId}/prepare`}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-700"
              >
                Practice it live →
              </Link>
            ) : (
              <Link
                href="/learn"
                className="rounded-lg border border-stone-300 px-5 py-2.5 font-semibold text-stone-700 hover:bg-stone-100"
              >
                Next lesson →
              </Link>
            )}
          </>
        ) : (
          <>
            <span className="font-semibold text-rose-700">
              {result.score}/{result.total} — review and retry
            </span>
            <button
              onClick={retry}
              className="rounded-lg border border-stone-300 px-5 py-2.5 font-semibold text-stone-700 hover:bg-stone-100"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </section>
  );
}
