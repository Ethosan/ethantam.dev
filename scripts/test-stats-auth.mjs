// The /stats sign-in (worker/stats-auth.js), run in Node with fake deps: no network, no secrets.
import { statsRoute, makeSession, sessionOk, cookieValue, sameSecret, COOKIE } from "../worker/stats-auth.js";

let failed = 0;
const check = (name, ok) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}`); if (!ok) failed++; };

const KEY = "correct horse";
const ORIGIN = "https://ethantam.dev";
const env = { STATS_KEY: KEY };
let tries = 0, limit = 5;
const deps = { allow: async () => ++tries <= limit, page: async () => "<h1>THE STATS</h1>", sec: { "x-content-type-options": "nosniff" } };
const reset = () => { tries = 0; };

const post = (body, origin = ORIGIN) => new Request(`${ORIGIN}/stats`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded", ...(origin ? { origin } : {}) },
  body: new URLSearchParams(body).toString(),
});
const get = (cookie) => new Request(`${ORIGIN}/stats`, { headers: cookie ? { cookie } : {} });
const route = (req, e = env) => statsRoute(req, e, deps);
const sessionFrom = (res) => cookieValue((res.headers.get("set-cookie") ?? "").split(";")[0], COOKIE);

// signed out: the form, never the browser's Basic auth box
{
  const res = await route(get());
  const body = await res.text();
  check("signed out GET shows the form (401)", res.status === 401 && body.includes('name="password"') && !body.includes("THE STATS"));
  check("signed out GET doesn't ask for Basic auth", !res.headers.get("www-authenticate"));
  check("the form page may post to itself (CSP form-action 'self')", /form-action 'self'/.test(res.headers.get("content-security-policy")));
  check("the form page isn't cached", res.headers.get("cache-control") === "no-store");
}

// a wrong password says so
{
  reset();
  const res = await route(post({ password: "nope" }));
  const body = await res.text();
  check("wrong password: 401 with 'Wrong password'", res.status === 401 && body.includes("Wrong password") && body.includes('role="alert"'));
  check("wrong password sets no cookie", !res.headers.get("set-cookie"));
  const empty = await route(post({}));
  check("no password at all is wrong too", empty.status === 401 && (await empty.text()).includes("Wrong password"));
  const close = await route(post({ password: KEY + " " }));
  check("the password with a trailing space is wrong", close.status === 401);
}

// the right one signs in
let session;
{
  reset();
  const res = await route(post({ password: KEY }));
  const sc = res.headers.get("set-cookie") ?? "";
  session = sessionFrom(res);
  check("right password: 303 back to /stats", res.status === 303 && res.headers.get("location") === "/stats");
  check("the cookie is HttpOnly, Secure, SameSite=Strict, 30 days", ["HttpOnly", "Secure", "SameSite=Strict", "Path=/", `Max-Age=${30 * 86400}`].every((a) => sc.includes(a)));
  const page = await route(get(`other=1; ${COOKIE}=${session}`));
  check("with the cookie, GET shows the stats (200)", page.status === 200 && (await page.text()).includes("THE STATS"));
}

// cookies that mustn't work
{
  const [exp, sig] = session.split(".");
  const flipped = sig.slice(0, -1) + (sig.at(-1) === "0" ? "1" : "0");
  check("a cookie with a changed signature is refused", (await route(get(`${COOKIE}=${exp}.${flipped}`))).status === 401);
  check("a cookie with a moved-out expiry is refused", (await route(get(`${COOKIE}=${+exp + 86400000}.${sig}`))).status === 401);
  check("rubbish in the cookie is refused", (await route(get(`${COOKIE}=hello`))).status === 401);
  check("a cookie from before STATS_KEY changed is refused", (await route(get(`${COOKIE}=${session}`), { STATS_KEY: "new key" })).status === 401);
  const old = await makeSession(KEY, Date.now() - 31 * 86400000);
  check("an expired cookie is refused", !(await sessionOk(old, KEY)) && (await route(get(`${COOKIE}=${old}`))).status === 401);
}

// rate limit, other sites, sign out, not set up
{
  reset(); limit = 2;
  await route(post({ password: "a" })); await route(post({ password: "b" }));
  const res = await route(post({ password: KEY }));
  check("past the limit: 429 'Too many tries', even with the right password", res.status === 429 && (await res.text()).includes("Too many tries") && !res.headers.get("set-cookie"));
  limit = 5; reset();
  check("viewing with a cookie doesn't use up tries", (await route(get(`${COOKIE}=${session}`))).status === 200 && tries === 0);
  const cross = await route(post({ password: KEY }, "https://evil.example"));
  check("a sign-in posted from another site is refused (403)", cross.status === 403 && !cross.headers.get("set-cookie"));
  check("a POST with no Origin is refused", (await route(post({ password: KEY }, null))).status === 403);
  const out = await route(post({ out: "1" }));
  check("sign out clears the cookie", out.status === 303 && /^__Host-stats=;.*Max-Age=0/.test(out.headers.get("set-cookie") ?? ""));
  const none = await route(get(), {});
  check("no STATS_KEY: 503, not an open page", none.status === 503 && !(await none.text()).includes("THE STATS"));
  check("PUT is 405", (await route(new Request(`${ORIGIN}/stats`, { method: "PUT" }))).status === 405);
}

check("sameSecret: equal / unequal / different lengths", (await sameSecret("abc", "abc")) && !(await sameSecret("abc", "abd")) && !(await sameSecret("abc", "abcd")));

if (failed) { console.error(`\n${failed} stats sign-in check(s) failed`); process.exit(1); }
console.log("\nstats sign-in: all checks passed");
