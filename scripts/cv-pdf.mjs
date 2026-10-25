/* Renders the CV in resume.html to ethan-tam-cv.pdf with headless Chrome, so the download is the same sheet the page
   shows and prints. Run it after every change to the CV:  npm run cv-pdf
   It fails if the CV runs onto a second page. Chrome or Edge is found in the usual places; set CHROME to its path
   otherwise. The repo is served over http for the render, because Chrome won't load the fonts from file://. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { extname, join, resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "ethan-tam-cv.pdf");
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

try {
  await promisify(execFile)(chrome, [
    "--headless",
    "--disable-gpu",
    "--no-pdf-header-footer",
    "--virtual-time-budget=5000", // let the fonts load before printing
    `--print-to-pdf=${out}`,
    `http://127.0.0.1:${server.address().port}/resume.html`,
  ]);
} finally {
  server.close();
}

const pages = readFileSync(out, "latin1").match(/\/Type\s*\/Page\b(?!s)/g)?.length ?? 0;
if (pages !== 1) {
  console.error(`cv-pdf: the CV came out at ${pages} pages; it has to fit on one. Trim it, then run this again.`);
  process.exit(1);
}
console.log(`cv-pdf: wrote ${out} (1 page)`);
