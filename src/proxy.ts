import { NextRequest, NextResponse } from "next/server";

/**
 * Access gate for hosted test environments.
 *
 * If NEGO_ACCESS_CODE is set, every request must carry a matching cookie.
 * First visit: open any URL with ?code=<the code> (or use the form on the
 * gate page) — the cookie is set for a year and the code stripped from the
 * URL, so on a phone you log in once and forget it.
 *
 * Unset NEGO_ACCESS_CODE (e.g. local dev) → no gate at all.
 */

const COOKIE = "nego_access";

export function proxy(request: NextRequest) {
  const code = process.env.NEGO_ACCESS_CODE;
  if (!code) return NextResponse.next();

  const url = request.nextUrl;
  const supplied = url.searchParams.get("code");
  if (supplied !== null) {
    if (supplied === code) {
      const clean = url.clone();
      clean.searchParams.delete("code");
      const res = NextResponse.redirect(clean);
      res.cookies.set(COOKIE, code, {
        httpOnly: true,
        sameSite: "lax",
        secure: url.protocol === "https:",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      });
      return res;
    }
    return gatePage("That code didn't work — try again.");
  }

  if (request.cookies.get(COOKIE)?.value === code) return NextResponse.next();

  // API calls get a JSON 401; humans get the gate page.
  if (url.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Access code required" }, { status: 401 });
  }
  return gatePage();
}

function gatePage(message = ""): NextResponse {
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>nego — private test</title>
<style>
  body{font-family:system-ui,sans-serif;background:#fafaf9;color:#1c1917;display:grid;place-items:center;min-height:100vh;margin:0}
  main{text-align:center;padding:2rem;max-width:20rem}
  h1{font-size:2rem;margin:0 0 .25rem}
  p{color:#78716c;font-size:.9rem}
  input{width:100%;box-sizing:border-box;padding:.7rem 1rem;border:1px solid #d6d3d1;border-radius:.6rem;font-size:1rem;margin-top:1rem;text-align:center}
  button{width:100%;padding:.7rem 1rem;margin-top:.5rem;border:0;border-radius:.6rem;background:#4f46e5;color:#fff;font-size:1rem;font-weight:600;cursor:pointer}
  .err{color:#dc2626;font-size:.85rem;min-height:1.2em;margin-top:.5rem}
</style></head><body><main>
<h1>🤝 nego</h1>
<p>This is a private test environment.<br>Enter the access code to play.</p>
<form method="GET">
  <input name="code" placeholder="access code" autofocus autocomplete="off">
  <button type="submit">Enter</button>
</form>
<div class="err">${message}</div>
</main></body></html>`;
  return new NextResponse(html, {
    status: 401,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export const config = {
  // Everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
