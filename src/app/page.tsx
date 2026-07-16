import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto max-w-3xl">
      <section className="pt-10 pb-12 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-600">
          Learn negotiation by playing
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Learn a concept. Practice it for real.
          <br />
          Get a debrief that makes you better.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-stone-600">
          Short lessons on the ideas that actually move deals — then live,
          unpredictable negotiations against an AI counterpart who has secrets,
          moods, and a bottom line you&apos;ll have to discover.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/learn"
            className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Start learning
          </Link>
          <Link
            href="/play"
            className="rounded-lg border border-stone-300 bg-white px-6 py-3 font-semibold text-stone-700 hover:bg-stone-100"
          >
            Jump into a negotiation
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            emoji: "📘",
            title: "Learn",
            text: "Bite-size lessons: BATNA, anchoring, trade-offs — one concept at a time, with a quick check.",
          },
          {
            emoji: "🎭",
            title: "Play",
            text: "Negotiate in scenarios with hidden information, surprise events, and a counterpart that plays to win — every replay is different.",
          },
          {
            emoji: "📊",
            title: "Review",
            text: "Chess-style post-game: transparent scores, the other side's secrets revealed, and the deal you could have had.",
          },
        ].map((c) => (
          <div key={c.title} className="rounded-xl border border-stone-200 bg-white p-5">
            <div className="text-2xl">{c.emoji}</div>
            <h2 className="mt-2 font-bold">{c.title}</h2>
            <p className="mt-1 text-sm text-stone-600">{c.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
