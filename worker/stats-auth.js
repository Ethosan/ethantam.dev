// Sign-in for /stats: a password form on the page, then a cookie, instead of the browser's own Basic auth box. The box
// can't say "wrong password" (it just comes back), and some browsers and home-screen apps never show it at all.
//   GET  /stats  the stats with a good cookie, otherwise the form
//   POST /stats  password=... checks it (rate limited), sets the cookie and goes back to /stats; out=1 signs out
// The cookie is "<expiry>.<HMAC of it keyed by STATS_KEY>", so changing STATS_KEY signs every device out.
// Plain Web APIs only (no cloudflare: imports), so scripts/test-stats-auth.mjs can run it in Node.

export const COOKIE = "__Host-stats";
const DAYS = 30;
const enc = new TextEncoder();

// equal in constant time: compares SHA-256 digests byte by byte, so neither length nor content leaks through timing
export async function sameSecret(a, b) {
  const [x, y] = await Promise.all([a, b].map(async (s) => new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(String(s))))));
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

async function sign(key, msg) {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(`stats|${msg}`)));
  return [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function makeSession(key, now = Date.now()) {
  const exp = now + DAYS * 86_400_000;
  return `${exp}.${await sign(key, exp)}`;
}

export function cookieValue(header, name) {
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export async function sessionOk(value, key, now = Date.now()) {
  const m = /^(\d{13})\.([0-9a-f]{64})$/.exec(value ?? "");
  if (!m || +m[1] < now) return false;
  return sameSecret(m[2], await sign(key, m[1]));
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

export function signInPage(message = "") {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Stats · ethantam.dev</title>
<link rel="stylesheet" href="/fonts.css">
<style>
  :root { color-scheme: light dark; --ink: #1b1b19; --muted: #6d6c67; --line: #d8d6ce; --bg: #faf9f6; --bad: #b3261e; }
  @media (prefers-color-scheme: dark) { :root { --ink: #ecebe7; --muted: #9b9a95; --line: #3a3a36; --bg: #121211; --bad: #f2948b; } }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.5 Geist, system-ui, sans-serif; }
  main { max-width: 360px; margin: 0 auto; padding: 56px 20px; }
  h1 { font-size: 1.4rem; margin: 0 0 4px; }
  p { margin: 0 0 20px; color: var(--muted); }
  label { display: block; font-size: .875rem; margin-bottom: 6px; }
  input { box-sizing: border-box; width: 100%; font: inherit; font-size: 16px; padding: 10px 12px; color: inherit;
    background: transparent; border: 1px solid var(--line); border-radius: 8px; }
  button { margin-top: 12px; width: 100%; font: inherit; padding: 10px 12px; border: 0; border-radius: 8px;
    background: var(--ink); color: var(--bg); cursor: pointer; }
  .msg { margin: 10px 0 0; color: var(--bad); font-size: .875rem; }
</style>
</head>
<body>
<main>
  <h1>Who got the CV</h1>
  <p>This page is private. Enter the password to see it.</p>
  <form method="post" action="/stats">
    <label for="pw">Password</label>
    <input id="pw" name="password" type="password" autocomplete="current-password" required autofocus${message ? ' aria-describedby="msg" aria-invalid="true"' : ""}>
    ${message ? `<p class="msg" id="msg" role="alert">${esc(message)}</p>` : ""}
    <button type="submit">Sign in</button>
  </form>
</main>
</body>
</html>`;
}

// deps: allow() -> is this try within the rate limit; page() -> the stats page's HTML; sec -> headers for every response
export async function statsRoute(request, env, { allow, page, sec = {} }) {
  const base = { ...sec, "cache-control": "no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer" };
  const html = (status, body, more = {}) => new Response(body, {
    status,
    headers: {
      ...base,
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": "default-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
      ...more,
    },
  });
  const key = env.STATS_KEY;
  if (!key) return new Response("Stats aren't set up: the Worker needs a STATS_KEY secret.", { status: 503, headers: { ...base, "content-type": "text/plain; charset=utf-8" } });
  const url = new URL(request.url);

  if (request.method === "POST") {
    // a form posted from another site is refused (a browser always sends Origin on a POST)
    if (request.headers.get("origin") !== url.origin) return html(403, signInPage("That sign-in came from another site. Open this page and try again."));
    const form = await request.formData().catch(() => null);
    if (form?.get("out")) return new Response(null, { status: 303, headers: { ...base, location: "/stats", "set-cookie": `${COOKIE}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Strict` } });
    if (!(await allow())) return html(429, signInPage("Too many tries. Wait a minute, then try again."), { "retry-after": "60" });
    const given = form?.get("password");
    if (typeof given !== "string" || !given || !(await sameSecret(given, key))) return html(401, signInPage("Wrong password. Try again."));
    const session = await makeSession(key);
    return new Response(null, {
      status: 303,
      headers: { ...base, location: "/stats", "set-cookie": `${COOKIE}=${session}; Max-Age=${DAYS * 86_400}; Path=/; Secure; HttpOnly; SameSite=Strict` },
    });
  }
  if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405, headers: { ...base, allow: "GET, POST" } });

  if (!(await sessionOk(cookieValue(request.headers.get("cookie"), COOKIE), key))) return html(401, signInPage());
  return html(200, await page());
}
