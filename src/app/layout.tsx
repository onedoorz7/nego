import type { Metadata, Viewport } from "next";
import Link from "next/link";
import localFont from "next/font/local";
import "./globals.css";

const nunito = localFont({
  src: "./fonts/nunito-latin-var.woff2",
  display: "swap",
  weight: "200 1000",
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "nego — the haggling game",
  description:
    "Sit down at the table, read your opponent, and squeeze every point out of the deal.",
};

export const viewport: Viewport = {
  themeColor: "#0a0d1d",
};

const nav = [
  { href: "/", label: "Play" },
  { href: "/progress", label: "Scores" },
  { href: "/learn", label: "Learn" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={nunito.variable}>
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0d1d]/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <Link
              href="/"
              className="flex items-center gap-2 font-black tracking-tight"
            >
              <span className="text-2xl drop-shadow-[0_0_10px_rgba(99,102,241,0.8)]">
                🤝
              </span>
              <span className="text-xl text-white">
                nego
                <span className="ml-1.5 align-middle text-[9px] font-extrabold uppercase tracking-[0.2em] text-indigo-300/70">
                  beta
                </span>
              </span>
            </Link>
            <nav className="flex items-center gap-1">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded-full px-3.5 py-1.5 text-sm font-bold text-stone-300 transition hover:bg-white/10 hover:text-white"
                >
                  {n.label}
                </Link>
              ))}
              <Link
                href="/admin"
                title="Founder tools"
                className="ml-1 rounded-full px-2 py-1.5 text-sm text-stone-500 transition hover:bg-white/10 hover:text-stone-200"
              >
                ⚙︎
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-10 text-center text-xs font-semibold text-stone-500">
          nego · an experiment in learning negotiation through play
        </footer>
      </body>
    </html>
  );
}
