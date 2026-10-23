// Cloudflare Worker for ethantam.dev. Static files are served from the assets binding; this script handles the ticker:
//   GET /api/live    WebSocket that streams every price change as it happens
//   GET /api/quotes  the same prices as one JSON snapshot (first paint, and the fallback when a socket can't connect)
// Both come from one Durable Object, so every visitor sees the same numbers. While anyone is watching it holds two upstream
// sockets, Yahoo's streamer for the stocks and Binance's market-data stream for the crypto (one tick a second each), and
// polls Yahoo's chart endpoint for the previous closes and for whatever a socket misses. When the last visitor leaves it
// closes them and goes to sleep. (Coinbase's feed goes quiet after its first few messages when called from a Worker,
// most likely because it sits behind Cloudflare too; Binance and Yahoo don't.)

import { DurableObject } from "cloudflare:workers";

const COINS = { BTC: "BTCUSDT", ETH: "ETHUSDT", SOL: "SOLUSDT" }; // Binance symbols
const COINBASE = { BTC: "BTC-USD", ETH: "ETH-USD", SOL: "SOL-USD" }; // last resort when Binance's REST is down
const STOCKS = ["AXTI", "MU", "NBIS", "CRWV", "LLY", "GS", "IBKR", "NVDA", "CRWD", "NET", "CAT", "TWLO"];
const ORDER = [...Object.keys(COINS), ...STOCKS];

const UA = "Mozilla/5.0 (ethantam.dev ticker)";
const FLUSH_MS = 250;        // at most four pushes a second to each visitor
const WATCHDOG_MS = 10_000;  // alarm: upstream health, heartbeat, fallback polling
const STOCK_REST_MS = 60_000; // previous closes, while the stream is healthy
const IDLE_MS = 60_000;      // close the upstreams this long after the last visitor leaves

const text = new TextDecoder();
const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

// Yahoo's streamer sends base64 protobuf (PricingData). Only a few fields matter:
// 1 id, 2 price (float), 3 time (sint64 ms), 7 market hours (0 pre, 1 regular, 2 post, 3 extended), 8 change % (float)
function decodePricing(b64) {
  const buf = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
  const view = new DataView(buf.buffer);
  const out = {};
  let i = 0;
  const varint = () => {
    let n = 0, mul = 1, b;
    do { b = buf[i++]; n += (b & 0x7f) * mul; mul *= 128; } while (b & 0x80 && i < buf.length);
    return n;
  };
  while (i < buf.length) {
    const key = varint(), field = key >>> 3, wire = key & 7;
    if (wire === 0) out[field] = varint();
    else if (wire === 5) { out[field] = view.getFloat32(i, true); i += 4; }
    else if (wire === 1) { out[field] = view.getFloat64(i, true); i += 8; }
    else if (wire === 2) { const len = varint(); out[field] = text.decode(buf.subarray(i, i + len)); i += len; }
    else break;
  }
  const t = out[3] ? (out[3] % 2 ? -(out[3] + 1) / 2 : out[3] / 2) : Date.now(); // zigzag
  return { s: out[1], p: out[2], t, hours: out[7], c: out[8] };
}

// One stock from Yahoo's chart endpoint. Pre- and post-market bars are included, so outside 9:30-16:00 New York
// the last bar is newer than the regular-session price, and that's the one shown (tagged pre or ah).
async function stockRest(s) {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${s}?range=1d&interval=15m&includePrePost=true`,
      { headers: { "user-agent": UA } },
    );
    if (!r.ok) return null;
    const res = (await r.json())?.chart?.result?.[0];
    const m = res?.meta;
    if (!m?.regularMarketPrice) return null;
    const q = { s, p: m.regularMarketPrice, t: m.regularMarketTime * 1000, prev: m.chartPreviousClose ?? m.previousClose };
    const reg = m.tradingPeriods?.regular?.flat?.().at(-1) ?? m.currentTradingPeriod?.regular;
    const ts = res.timestamp ?? [], close = res.indicators?.quote?.[0]?.close ?? [];
    for (let i = ts.length - 1; i >= 0; i--) {
      if (close[i] == null) continue;
      if (reg && (ts[i] < reg.start || ts[i] >= reg.end)) {
        q.p = close[i];
        q.t = Math.max(q.t, ts[i] * 1000);
        q.x = ts[i] < reg.start ? "pre" : "ah";
      }
      break;
    }
    const day = m.currentTradingPeriod;
    if (day?.pre && day?.post) q.session = [day.pre.start * 1000, day.post.end * 1000];
    return q;
  } catch {
    return null;
  }
}

// The coins from Binance: last trade, and the change against the price 24 hours ago (what the socket reports too).
async function coinsRest() {
  try {
    const symbols = encodeURIComponent(JSON.stringify(Object.values(COINS)));
    const r = await fetch(`https://data-api.binance.vision/api/v3/ticker/24hr?symbols=${symbols}&type=MINI`, { headers: { "user-agent": UA } });
    if (!r.ok) throw new Error(r.status);
    const bySymbol = Object.fromEntries(Object.entries(COINS).map(([s, b]) => [b, s]));
    return (await r.json()).map((d) => {
      const p = +d.lastPrice, open = +d.openPrice;
      return { s: bySymbol[d.symbol], p, t: d.closeTime, c: open ? ((p - open) / open) * 100 : null };
    });
  } catch {
    return Promise.all(Object.keys(COINS).map(coinbaseRest));
  }
}

async function coinbaseRest(s) {
  try {
    const base = `https://api.exchange.coinbase.com/products/${COINBASE[s]}`;
    const [tick, stats] = await Promise.all(
      [`${base}/ticker`, `${base}/stats`].map((u) => fetch(u, { headers: { "user-agent": UA } }).then((r) => (r.ok ? r.json() : null))),
    );
    const p = +tick?.price, open = +stats?.open;
    if (!p) return null;
    return { s, p, t: Date.parse(tick.time) || Date.now(), c: open ? ((p - open) / open) * 100 : null };
  } catch {
    return null;
  }
}

export class Ticker extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.quotes = new Map(); // symbol -> { s, p, c, t, x? }
    this.prev = new Map();   // stock -> previous regular-session close
    this.dirty = new Set();
    this.up = { yahoo: null, binance: null }; // upstream sockets
    this.heard = { yahoo: 0, binance: 0 };
    this.opening = {};
    this.debug = { yahoo: {}, binance: {} }; // upstream state for /api/quotes?debug
    this.session = null;     // [pre-market open, post-market close] in ms, from Yahoo
    this.lastStockRest = 0;
    this.lastSent = 0;
    this.lastSaved = 0;
    this.lastVisitor = Date.now();
    // the last good prices, so a cold start with Yahoo down still has something to show
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get(["quotes", "prev"]);
      for (const q of saved.get("quotes") ?? []) this.quotes.set(q.s, q);
      for (const [s, p] of saved.get("prev") ?? []) this.prev.set(s, p);
    });
  }

  async fetch(request) {
    if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
      const [client, server] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server);
      this.lastVisitor = Date.now();
      this.wake();
      const hello = () => server.send(this.frame(this.snapshot()));
      // after a quiet spell, fetch fresh numbers before the first frame rather than send old ones
      if (this.stale()) this.refresh().finally(hello);
      else hello();
      return new Response(null, { status: 101, webSocket: client });
    }
    if (new URL(request.url).searchParams.has("debug")) {
      const now = Date.now();
      const up = Object.fromEntries(Object.keys(this.up).map((n) => [n, {
        open: !!this.up[n], healthy: this.healthy(n), quietMs: this.heard[n] ? now - this.heard[n] : null, ...this.debug[n],
      }]));
      return json({ t: now, visitors: this.ctx.getWebSockets().length, marketOpen: this.marketOpen(), up });
    }
    if (this.stale()) await this.refresh();
    return json({ t: Date.now(), quotes: this.snapshot() });
  }

  // visitors never send anything that matters; the close handshake is all
  webSocketMessage() {}
  webSocketClose(ws, code) {
    try { ws.close(code === 1005 ? 1000 : code); } catch {}
    this.lastVisitor = Date.now();
  }
  webSocketError(ws) { this.webSocketClose(ws, 1011); }

  async alarm() {
    const now = Date.now();
    if (this.ctx.getWebSockets().length) this.lastVisitor = now;
    else if (now - this.lastVisitor > IDLE_MS) return this.sleep();

    // reconnect anything that dropped or went quiet
    if (this.up.binance && now - this.heard.binance > 30_000) this.drop("binance");
    if (this.up.yahoo && this.marketOpen() && now - this.heard.yahoo > 60_000) this.drop("yahoo");
    this.openYahoo();
    this.openBinance();
    try { this.up.yahoo?.send(JSON.stringify({ subscribe: STOCKS })); } catch {} // Yahoo forgets idle subscriptions

    // REST fills in whatever a socket isn't delivering
    const jobs = [];
    if (!this.healthy("yahoo") || now - this.lastStockRest > STOCK_REST_MS) jobs.push(this.refreshStocks());
    if (!this.healthy("binance")) jobs.push(this.refreshCoins());
    await Promise.all(jobs);

    if (now - this.lastSent > WATCHDOG_MS - 1000) this.broadcast([]); // heartbeat: visitors reconnect if they hear nothing
    if (now - this.lastSaved > 60_000) this.save();
    await this.ctx.storage.setAlarm(Date.now() + WATCHDOG_MS);
  }

  wake() {
    this.openYahoo();
    this.openBinance();
    this.ctx.storage.getAlarm().then((at) => at || this.ctx.storage.setAlarm(Date.now() + WATCHDOG_MS));
  }

  async sleep() {
    this.drop("yahoo");
    this.drop("binance");
    await this.save();
  }

  snapshot() {
    return ORDER.map((s) => this.quotes.get(s)).filter(Boolean);
  }

  frame(list) {
    return JSON.stringify({ t: Date.now(), quotes: list });
  }

  marketOpen() {
    const now = Date.now();
    return !!this.session && now >= this.session[0] && now < this.session[1];
  }

  healthy(name) {
    if (!this.up[name]) return false;
    const quiet = Date.now() - this.heard[name];
    return name === "binance" ? quiet < 30_000 : !this.marketOpen() || quiet < 60_000;
  }

  stale() {
    return !(this.healthy("yahoo") && this.healthy("binance")) && Date.now() - this.lastStockRest > WATCHDOG_MS;
  }

  // merge one price, newest wins. REST is `force`d while its socket is down, since then it's the newest there is.
  put({ s, p, c, t, x }, force = false) {
    if (!(p > 0) || !ORDER.includes(s)) return;
    const cur = this.quotes.get(s);
    if (cur && !force && t < cur.t) return;
    const ref = this.prev.get(s);
    const chg = ref ? ((p - ref) / ref) * 100 : c;
    const q = { s, p: round(p, 4), c: typeof chg === "number" ? round(chg, 2) : null, t: Math.max(t, cur?.t ?? 0) };
    if (x) q.x = x;
    this.quotes.set(s, q);
    if (cur && cur.p === q.p && cur.c === q.c && cur.x === q.x) return;
    this.dirty.add(s);
    this.flushSoon();
  }

  flushSoon() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      const list = [...this.dirty].map((s) => this.quotes.get(s));
      this.dirty.clear();
      if (list.length) this.broadcast(list);
    }, Math.max(0, this.lastSent + FLUSH_MS - Date.now()));
  }

  broadcast(list) {
    const msg = this.frame(list);
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(msg); } catch {}
    }
    this.lastSent = Date.now();
  }

  refresh() {
    return (this.refreshing ??= Promise.all([this.refreshStocks(), this.refreshCoins()])
      .finally(() => { this.refreshing = null; }));
  }

  async refreshStocks() {
    const list = await Promise.all(STOCKS.map(stockRest));
    for (const q of list) {
      if (!q) continue;
      if (q.prev) this.prev.set(q.s, q.prev);
      if (q.session) this.session = q.session;
      this.put(q, !this.healthy("yahoo"));
    }
    this.lastStockRest = Date.now();
  }

  async refreshCoins() {
    for (const q of await coinsRest()) if (q) this.put(q, !this.healthy("binance"));
  }

  save() {
    this.lastSaved = Date.now();
    return this.ctx.storage.put({ quotes: this.snapshot(), prev: [...this.prev] }).catch(() => {});
  }

  drop(name) {
    const ws = this.up[name];
    this.up[name] = null; // before close(), so the close listener doesn't reconnect
    try { ws?.close(1000); } catch {}
  }

  async connect(name, url, headers, onOpen, onMessage) {
    if (this.up[name] || this.opening[name]) return;
    this.opening[name] = true;
    try {
      const r = await fetch(url, { headers: { upgrade: "websocket", "user-agent": UA, ...headers } });
      const ws = r.webSocket;
      if (!ws) throw new Error(`upgrade refused: ${r.status} ${(await r.text().catch(() => "")).slice(0, 120)}`);
      ws.accept();
      this.up[name] = ws;
      this.heard[name] = Date.now();
      this.debug[name] = { since: Date.now(), messages: 0 };
      ws.addEventListener("message", (e) => {
        this.heard[name] = Date.now();
        this.debug[name].messages++;
        try { onMessage(e.data); } catch {}
      });
      const gone = (e) => {
        this.debug[name].last = `closed ${e?.code ?? ""} ${e?.reason ?? e?.message ?? ""}`.trim();
        if (this.up[name] !== ws) return;
        this.up[name] = null;
        if (this.ctx.getWebSockets().length) setTimeout(() => (name === "yahoo" ? this.openYahoo() : this.openBinance()), 2000);
      };
      ws.addEventListener("close", gone);
      ws.addEventListener("error", gone);
      onOpen(ws);
    } catch (err) {
      this.debug[name] = { last: String(err), at: Date.now() };
    } finally {
      this.opening[name] = false;
    }
  }

  openYahoo() {
    return this.connect(
      "yahoo",
      "https://streamer.finance.yahoo.com/?version=2",
      { origin: "https://finance.yahoo.com" },
      (ws) => ws.send(JSON.stringify({ subscribe: STOCKS })),
      (data) => {
        const msg = JSON.parse(data);
        if (msg.type !== "pricing") return;
        const d = decodePricing(msg.message);
        const x = d.hours === 0 ? "pre" : d.hours >= 2 ? "ah" : undefined;
        this.put({ s: d.s, p: d.p, c: d.c, t: d.t, x });
      },
    );
  }

  // a mini ticker per coin every second: last price (c) and the price 24 hours ago (o)
  openBinance() {
    const ids = Object.fromEntries(Object.entries(COINS).map(([s, b]) => [b, s]));
    const streams = Object.values(COINS).map((b) => `${b.toLowerCase()}@miniTicker`).join("/");
    return this.connect(
      "binance",
      `https://data-stream.binance.vision/stream?streams=${streams}`,
      {},
      () => {},
      (data) => {
        const d = JSON.parse(data).data;
        if (!ids[d?.s]) return;
        const p = +d.c, open = +d.o;
        this.put({ s: ids[d.s], p, c: open ? ((p - open) / open) * 100 : null, t: d.E || Date.now() });
      },
    );
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if ((url.pathname === "/api/live" || url.pathname === "/api/quotes") && request.method === "GET") {
      // the socket is for this site's own page
      const origin = request.headers.get("origin");
      const host = (() => { try { return new URL(origin).host; } catch { return null; } })();
      if (url.pathname === "/api/live" && origin && host !== url.host) return new Response("forbidden", { status: 403 });
      try {
        return await env.TICKER.get(env.TICKER.idFromName("watchlist")).fetch(request);
      } catch {
        return json({ t: Date.now(), quotes: [] }, 503);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
