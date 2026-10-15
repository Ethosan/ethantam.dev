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

async function quotes(request, ctx) {
  const cache = caches.default;
  const key = new Request(new URL("/api/quotes", request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;

  const list = await Promise.all(WATCHLIST.map(quote));
  const res = new Response(JSON.stringify({ t: Date.now(), quotes: list }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${TTL}`,
    },
  });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/quotes" && request.method === "GET") return quotes(request, ctx);
    return env.ASSETS.fetch(request);
  },
};
