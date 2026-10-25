/* Renders the CV in resume.html with headless Chrome, so the downloads match what the page shows and prints:
     ethan-tam-cv.pdf  the PDF behind the Download button
     og-resume.png     the 1200x630 link preview for /resume (scripts/og-resume.html, with the CV copied in)
   When the CV's text has changed since the last run, it also moves the dates that say so: "Last updated" on /resume
   (beside the CV, never on it), dateModified in the page's structured data, and the sitemap's lastmod for /resume and
   the PDF. A hash of the text sits beside the date, so re-rendering an unchanged CV keeps it.
   Run it after every change to the CV:  npm run cv-pdf
   It fails if the CV runs onto a second page. Chrome or Edge is found in the usual places; set CHROME to its path
   otherwise. The repo is served over http for the render, because Chrome won't load the fonts from file://. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { extname, join, resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pdf = join(root, "ethan-tam-cv.pdf");
const card = join(root, "og-resume.png");
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".json": "application/json" };

const chrome = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((p) => p && existsSync(p));
if (!chrome) {
  console.error("cv-pdf: no Chrome or Edge found. Set CHROME to its path.");
  process.exit(1);
}

// the CV's text, without its markup: what changing the CV means
const resumePath = join(root, "resume.html");
let resume = readFileSync(resumePath, "utf8");
const article = resume.match(/<article\b[^>]*\bid="cv"[^>]*>[\s\S]*?<\/article>/)?.[0];
const stamp = /<time data-cv-updated data-hash="([0-9a-f]*)" datetime="[0-9-]*">[^<]*<\/time>/;
if (!article || !stamp.test(resume)) {
  console.error("cv-pdf: resume.html needs its <article id=\"cv\"> and the <time data-cv-updated> beside it.");
  process.exit(1);
}
const text = article.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const hash = createHash("sha256").update(text).digest("hex").slice(0, 16);
if (resume.match(stamp)[1] !== hash) {
  const now = new Date();
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(now); // 2026-10-25
  const shown = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Singapore" }).format(now);
  resume = resume
    .replace(stamp, `<time data-cv-updated data-hash="${hash}" datetime="${iso}">${shown}</time>`)
    .replace(/"@type":"ProfilePage",("dateModified":"[0-9-]+",)?/, `"@type":"ProfilePage","dateModified":"${iso}",`);
  writeFileSync(resumePath, resume);
  const sitemapPath = join(root, "sitemap.xml");
  const sitemap = readFileSync(sitemapPath, "utf8").replace(
    /(<loc>https:\/\/ethantam\.dev\/(?:resume|ethan-tam-cv\.pdf)<\/loc><lastmod>)[0-9-]+(<\/lastmod>)/g, `$1${iso}$2`);
  writeFileSync(sitemapPath, sitemap);
  console.log(`cv-pdf: the CV's text changed, so "Last updated" is now ${shown}`);
}

const server = createServer(async (req, res) => {
  const file = join(root, decodeURIComponent(new URL(req.url, "http://localhost").pathname));
  if (!file.startsWith(root + sep)) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const at = (path) => `http://127.0.0.1:${server.address().port}/${path}`;
// virtual time lets the fonts load, and the card fetch its CV, before Chrome prints or shoots
const run = (args) => promisify(execFile)(chrome, ["--headless", "--disable-gpu", "--virtual-time-budget=5000", ...args]);

try {
  await run(["--no-pdf-header-footer", `--print-to-pdf=${pdf}`, at("resume.html")]);
  await run(["--hide-scrollbars", "--window-size=1200,630", `--screenshot=${card}`, at("scripts/og-resume.html")]);
} finally {
  server.close();
}

const pages = readFileSync(pdf, "latin1").match(/\/Type\s*\/Page\b(?!s)/g)?.length ?? 0;
if (pages !== 1) {
  console.error(`cv-pdf: the CV came out at ${pages} pages; it has to fit on one. Trim it, then run this again.`);
  process.exit(1);
}
console.log(`cv-pdf: wrote ${pdf} (1 page) and ${card} (${Math.round(statSync(card).size / 1024)} KB)`);
