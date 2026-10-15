// Cloudflare Worker for ethantam.dev. Static files are served from the assets binding;
// this script only handles GET /api/quotes, which pulls the watchlist from Yahoo's chart endpoint server-side (browsers are blocked by CORS)
// and caches the combined result at the edge for 60 seconds.

const WATCHLIST = [
  ["BTC", "BTC-USD"], ["ETH", "ETH-USD"], ["SOL", "SOL-USD"],
  ["AXTI"], ["MU"], ["NBIS"], ["CRWV"], ["LLY"], ["GS"], ["IBKR"],
  ["NVDA"], ["CRWD"], ["NET"], ["CAT"], ["TWLO"],
];
const TTL = 60;

async function quote([label, yahoo = label]) {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}?range=1d&interval=1d`,
      { headers: { "user-agent": "Mozilla/5.0 (ethantam.dev ticker)" } },
    );
    if (!r.ok) return { s: label };
    const m = (await r.json())?.chart?.result?.[0]?.meta;
    if (!m?.regularMarketPrice) return { s: label };
    const prev = m.chartPreviousClose || m.previousClose;
    return {
      s: label,
      p: m.regularMarketPrice,
      c: prev ? ((m.regularMarketPrice - prev) / prev) * 100 : null,
    };
  } catch {
    return { s: label };
  }
}

const STALE_TTL = 60 * 60 * 24;
const json = (body, cacheControl) => new Response(JSON.stringify(body), {
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": cacheControl },
});

async function quotes(request, ctx) {
  const cache = caches.default;
  const base = new URL(request.url).origin;
  const freshKey = new Request(`${base}/api/quotes`);
  const staleKey = new Request(`${base}/api/quotes?stale`);

  const hit = await cache.match(freshKey);
  if (hit) return new Response(hit.body, { headers: { ...Object.fromEntries(hit.headers), "cache-control": "no-store" } });

  const list = await Promise.all(WATCHLIST.map(quote));
  const body = { t: Date.now(), quotes: list };

  if (!list.some((q) => typeof q.p === "number")) {
    // Yahoo is down or blocking us: serve the last good result rather than caching a blank one
    const stale = await cache.match(staleKey);
    if (stale) return new Response(stale.body, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-quotes-stale": "1" } });
    return json(body, "no-store");
  }

  ctx.waitUntil(Promise.all([
    cache.put(freshKey, json(body, `public, max-age=${TTL}`)),
    cache.put(staleKey, json(body, `public, max-age=${STALE_TTL}`)),
  ]));
  // the edge does the caching; browsers always ask again
  return json(body, "no-store");
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/quotes" && request.method === "GET") return quotes(request, ctx);
    return env.ASSETS.fetch(request);
  },
};
