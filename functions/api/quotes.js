// Cloudflare Pages Function: GET /api/quotes
// Pulls the watchlist from Yahoo's chart endpoint server-side (browsers are blocked by CORS)
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

export async function onRequestGet({ request, waitUntil }) {
  const cache = caches.default;
  const key = new Request(new URL("/api/quotes", request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;

  const quotes = await Promise.all(WATCHLIST.map(quote));
  const res = new Response(JSON.stringify({ t: Date.now(), quotes }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${TTL}`,
    },
  });
  waitUntil(cache.put(key, res.clone()));
  return res;
}
