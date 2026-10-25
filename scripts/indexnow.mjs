/* Tells the IndexNow search engines (Bing, Yandex, Seznam and others) that the site's pages changed, so they
   re-crawl them now instead of whenever they next pass. Google doesn't take part: for Google, use Search Console.
   CI runs it after every deploy. It submits the URLs in sitemap.xml, and proves the site is ours with the key file
   at the root (<32 hex characters>.txt, which contains its own name). It never fails the build.  node scripts/indexnow.mjs */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const keyFile = readdirSync(root).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
const urlList = [...readFileSync(resolve(root, "sitemap.xml"), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

try {
  if (!keyFile) throw new Error("no key file");
  const key = keyFile.slice(0, -4);
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: "ethantam.dev", key, keyLocation: `https://ethantam.dev/${keyFile}`, urlList }),
  });
  // 200 and 202 both mean accepted; 202 is the usual answer while the key is still being checked
  console.log(`indexnow: ${res.status} for ${urlList.length} URLs`);
} catch (err) {
  console.log(`indexnow: skipped (${err.message})`);
}
