// `npm test`: needs no network or secrets. Syntax-checks the scripts, and checks the things that must not silently
// go missing: the security headers, the Worker's rate limits, and the link-preview tags on every page.
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

let failed = 0;
const check = (name, ok) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}`); if (!ok) failed++; };
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

for (const f of ["worker/index.js", "worker/stats-auth.js", "main.js", "share.js", "resume.js", "sw.js", "scripts/bump-version.mjs", "scripts/indexnow.mjs"]) {
  const r = spawnSync(process.execPath, ["--check", new URL(`../${f}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")], { encoding: "utf8" });
  check(`${f} parses`, r.status === 0);
}

const headers = read("_headers");
for (const h of ["Strict-Transport-Security", "Content-Security-Policy", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy"]) {
  check(`_headers sets ${h}`, headers.includes(h));
}

const worker = read("worker/index.js");
check("worker puts the security headers on its own responses", /const SEC = \{[^}]*strict-transport-security[^}]*\}/s.test(worker) && worker.includes("...SEC"));
check("worker limits /api, the counters and /stats", ["RL_API", "RL_COUNT", "RL_AUTH"].every((n) => worker.includes(`env.${n}`)));
check("worker needs an Origin on /api/live", worker.includes('url.pathname === "/api/live" && host !== url.host'));
check("worker keys the /api/projects cache without the query", worker.includes("cached(new Request(`${url.origin}/api/projects`)"));
check("worker keeps ?debug behind the stats password", worker.includes('searchParams.has("debug") && !(env.STATS_KEY'));

const wrangler = read("wrangler.jsonc");
check("wrangler.jsonc binds the three rate limits", ["RL_API", "RL_COUNT", "RL_AUTH"].every((n) => wrangler.includes(`"${n}"`)));
check("wrangler.jsonc turns workers.dev off", /"workers_dev":\s*false/.test(wrangler));

for (const f of [".gitignore", ".assetsignore"]) {
  check(`${f} lists secret files`, [".env*", ".dev.vars*", ".zizidesk-session"].every((l) => read(f).split(/\r?\n/).includes(l)));
}

for (const f of readdirSync(new URL("../", import.meta.url)).filter((n) => n.endsWith(".html") && !["404.html", "offline.html"].includes(n))) {
  const html = read(f);
  check(`${f} has og:title, og:image and twitter:card`, ["og:title", "og:image", "twitter:card"].every((p) => html.includes(`"${p}"`)));
}

const sw = read("sw.js");
check("sw.js caches only OK page responses", /if \(res\.ok\)[\s\S]{0,120}cache\.put\(request, copy\)[\s\S]{0,200}\.catch/.test(sw));
check("sw.js sends offline navigations to /offline.html", sw.includes('"/offline.html"') && sw.includes('caches.match("/offline.html")'));

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log("\nall checks passed");
