// Cloudflare Worker for ethantam.dev. Static files are served from the assets binding; this script handles:
//   GET /              the home page, with "Last updated" stamped from the deploy's date
//   GET /api/live      WebSocket that streams every price change as it happens
//   GET /api/quotes    the same prices as one JSON snapshot (first paint, and the fallback when a socket can't connect)
//   GET /api/spark     one symbol's path for the ticker popover (edge-cached 60s)
//   GET /api/projects  whether each project's app is up, and its last commit on GitLab (edge-cached 2 min)
//   GET /api/version   the live deploy: its id, time, and the commit it was built from
//   GET /ethan-tam-cv.pdf  the CV's PDF, counted as a download
//   GET /P, /Q         what the QR codes open (P the one printed on the CV, Q the one shown full screen), counted, then /
//   GET /stats         those counts, and the latest downloads and scans, behind a password (the STATS_KEY secret)
// The ticker:
// Both come from one Durable Object, so every visitor sees the same numbers. While anyone is watching it holds two upstream
// sockets, Yahoo's streamer for the stocks and Binance's market-data stream for the crypto (one tick a second each), and
// polls Yahoo's chart endpoint for the previous closes and for whatever a socket misses. When the last visitor leaves it
// closes them and goes to sleep. (Coinbase's feed goes quiet after its first few messages when called from a Worker,
// most likely because it sits behind Cloudflare too; Binance and Yahoo don't.)

import { DurableObject } from "cloudflare:workers";

const COINS = { BTC: "BTCUSDT", ETH: "ETHUSDT", SOL: "SOLUSDT" }; // Binance symbols
const COINBASE = { BTC: "BTC-USD", ETH: "ETH-USD", SOL: "SOL-USD" }; // REST for the coins (see coinsRest)
const STOCKS = ["AXTI", "MU", "NBIS", "LLY", "GS", "IBKR", "NVDA", "CRWD", "NET", "CAT"]; // on New York hours
// Not on New York hours, so no PRE/AH tags and no say in when the market is open. Ticker label -> Yahoo symbol.
const ELSEWHERE = { US10Y: "^TNX", USDJPY: "JPY=X", DBS: "D05.SI" };
const YAHOO = { ...Object.fromEntries(STOCKS.map((s) => [s, s])), ...ELSEWHERE }; // everything from Yahoo, by label
const LABEL = Object.fromEntries(Object.entries(YAHOO).map(([label, y]) => [y, label]));
const ORDER = [...Object.keys(COINS), ...Object.keys(YAHOO)];

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

// One symbol from Yahoo's chart endpoint, by its ticker label. Pre- and post-market bars are included, so outside
// 9:30-16:00 New York a stock's last bar is newer than the regular-session price, and that's the one shown (tagged pre
// or ah). Only New York stocks are tagged, and only they set the session.
async function stockRest(s) {
  const us = !ELSEWHERE[s];
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(YAHOO[s])}?range=1d&interval=15m&includePrePost=true`,
      { headers: { "user-agent": UA } },
    );
    if (!r.ok) return null;
    const res = (await r.json())?.chart?.result?.[0];
    const m = res?.meta;
    if (!m?.regularMarketPrice) return null;
    const q = { s, p: m.regularMarketPrice, t: m.regularMarketTime * 1000, prev: m.chartPreviousClose ?? m.previousClose };
    const reg = m.tradingPeriods?.regular?.flat?.().at(-1) ?? m.currentTradingPeriod?.regular;
    const ts = res.timestamp ?? [], close = res.indicators?.quote?.[0]?.close ?? [];
    for (let i = ts.length - 1; us && i >= 0; i--) {
      if (close[i] == null) continue;
      if (reg && (ts[i] < reg.start || ts[i] >= reg.end)) {
        q.p = close[i];
        q.t = Math.max(q.t, ts[i] * 1000);
        q.x = ts[i] < reg.start ? "pre" : "ah";
      }
      break;
    }
    const day = m.currentTradingPeriod;
    if (us && day?.pre && day?.post) q.session = [day.pre.start * 1000, day.post.end * 1000];
    return q;
  } catch {
    return null;
  }
}

// The coins over REST, for a cold start or while the Binance socket is down. Binance's REST API answers 403 to requests
// from Cloudflare (its socket is fine), so this asks Coinbase: last trade, and the change against 24 hours ago.
function coinsRest() {
  return Promise.all(Object.keys(COINS).map(coinbaseRest));
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
    try { this.up.yahoo?.send(JSON.stringify({ subscribe: Object.values(YAHOO) })); } catch {} // Yahoo forgets idle subscriptions

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
    const list = await Promise.all(Object.keys(YAHOO).map(stockRest));
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
      (ws) => ws.send(JSON.stringify({ subscribe: Object.values(YAHOO) })),
      (data) => {
        const msg = JSON.parse(data);
        if (msg.type !== "pricing") return;
        const d = decodePricing(msg.message);
        const s = LABEL[d.s];
        const x = ELSEWHERE[s] ? undefined : d.hours === 0 ? "pre" : d.hours >= 2 ? "ah" : undefined;
        this.put({ s, p: d.p, c: d.c, t: d.t, x });
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

// ---------- who got the CV: downloads of the PDF and scans of the two QR codes ----------
// Each is a row in the Stats Durable Object's SQLite: when, which, the place and network Cloudflare puts the request in,
// the device, and for a download the page or site that linked to it. No IP address and no cookie. So that one person
// fetching twice counts once, a repeat within 30 minutes is dropped, matched by a code made from the IP and browser with a
// salt that's replaced every day (so it can't be turned back into either) and blanked after a day. Rows are kept a year.
// Crawlers and link previews are kept too, marked, and left out of the totals. /stats shows it all, behind STATS_KEY.

const QR = { "/P": "qr-cv", "/p": "qr-cv", "/Q": "qr-phone", "/q": "qr-phone" }; // what the codes encode (capitals pack tighter)
const DID = { cv: "Downloaded the CV", "qr-cv": "Scanned the QR on your CV", "qr-phone": "Scanned the QR on your phone" };
const TILE = { cv: "CV downloads", "qr-cv": "Scans of the QR on your CV", "qr-phone": "Scans of the QR on your phone" };
const REPEAT_MS = 30 * 60_000;
const KEEP_MS = 365 * 86_400_000;
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|google-|curl|wget|python|go-http|node-fetch|axios|okhttp|java\/|httpclient|scrapy|^whatsapp\//i;

export class Stats extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS events (ts INTEGER NOT NULL, kind TEXT NOT NULL, source TEXT, city TEXT,
      country TEXT, network TEXT, device TEXT, bot INTEGER NOT NULL DEFAULT 0, visitor TEXT)`);
    this.sql.exec("CREATE INDEX IF NOT EXISTS events_ts ON events (ts)");
  }

  async record(row, who) {
    const now = Date.now();
    const visitor = row.bot ? null : await this.visitor(who, now);
    const seen = visitor && this.sql.exec(
      "SELECT 1 FROM events WHERE kind = ? AND visitor = ? AND ts > ? LIMIT 1", row.kind, visitor, now - REPEAT_MS,
    ).toArray().length;
    if (seen) return;
    this.sql.exec(
      "INSERT INTO events (ts, kind, source, city, country, network, device, bot, visitor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      now, row.kind, row.source, row.city, row.country, row.network, row.device, row.bot ? 1 : 0, visitor,
    );
    this.sql.exec("UPDATE events SET visitor = NULL WHERE visitor IS NOT NULL AND ts < ?", now - 86_400_000);
    this.sql.exec("DELETE FROM events WHERE ts < ?", now - KEEP_MS);
  }

  // today's code for this IP and browser; the salt is random and lasts until the day (UTC) changes
  async visitor(who, now) {
    const day = new Date(now).toISOString().slice(0, 10);
    let salt = await this.ctx.storage.get("salt");
    if (salt?.day !== day) await this.ctx.storage.put("salt", (salt = { day, value: crypto.randomUUID() }));
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt.value}|${who}`)));
    return [...hash.subarray(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async report(limit = 200) {
    const now = Date.now();
    const totals = this.sql.exec(
      "SELECT kind, SUM(ts > ?) AS week, SUM(ts > ?) AS month, COUNT(*) AS total FROM events WHERE bot = 0 GROUP BY kind",
      now - 7 * 86_400_000, now - 30 * 86_400_000,
    ).toArray();
    const { since, bots } = this.sql.exec("SELECT MIN(ts) AS since, SUM(bot) AS bots FROM events").one();
    const recent = this.sql.exec(
      "SELECT ts, kind, source, city, country, network, device, bot FROM events ORDER BY ts DESC LIMIT ?", limit,
    ).toArray();
    return { totals, since, bots, recent };
  }
}

function device(ua) {
  const os = /iPhone|iPod/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad"
    : /Android/.test(ua) ? (/Mobile/.test(ua) ? "Android phone" : "Android tablet")
    : /Windows/.test(ua) ? "Windows" : /Macintosh/.test(ua) ? "Mac" : /CrOS/.test(ua) ? "Chromebook" : /Linux/.test(ua) ? "Linux" : "";
  const app = /LinkedInApp/.test(ua) ? "LinkedIn app" : /Instagram/.test(ua) ? "Instagram app" : /FBAN|FBAV/.test(ua) ? "Facebook app"
    : /Edg(A|iOS)?\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /OPR\/|OPT\//.test(ua) ? "Opera"
    : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Chrome|CriOS/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "";
  return [os, app].filter(Boolean).join(" · ") || "unknown device";
}

const botName = (ua) => (ua.match(/[\w-]*(?:bot|crawler|spider|preview)[\w-]*/i)?.[0] ?? (ua.split(/[\s/;(]/)[0] || "no user agent")).slice(0, 40);

// where a download was linked from: a path on this site, another site's name (never the rest of its address), or null
// when nothing says (typed, a chat or email app, a saved link)
function linkedFrom(request, url) {
  try {
    const ref = new URL(request.headers.get("referer"));
    return ref.host === url.host ? ref.pathname : ref.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function count(kind, request, url, env, ctx) {
  const ua = request.headers.get("user-agent") ?? "";
  const bot = !ua || BOT.test(ua);
  const cf = request.cf ?? {};
  const row = {
    kind,
    source: kind === "cv" ? linkedFrom(request, url) : null,
    city: cf.city ?? null,
    country: cf.country ?? null,
    network: cf.asOrganization ?? null,
    device: bot ? botName(ua) : device(ua),
    bot,
  };
  const who = `${request.headers.get("cf-connecting-ip") ?? ""}|${ua}`;
  ctx.waitUntil((async () => {
    try { await env.STATS.get(env.STATS.idFromName("ethantam.dev")).record(row, who); } catch {}
  })());
}

// Basic auth: any user name, STATS_KEY as the password, compared in constant time
async function allowed(request, key) {
  const [scheme, b64] = (request.headers.get("authorization") ?? "").split(" ");
  if (scheme?.toLowerCase() !== "basic" || !b64) return false;
  let pass;
  try {
    pass = text.decode(Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))).split(":").slice(1).join(":");
  } catch {
    return false;
  }
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([pass, key].map((s) => crypto.subtle.digest("SHA-256", enc.encode(s))));
  return crypto.subtle.timingSafeEqual(a, b);
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const regionName = new Intl.DisplayNames(["en"], { type: "region" });
const countryName = (code) => { try { return regionName.of(code); } catch { return code; } };
const whenFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Singapore",
});

function statsPage({ totals, since, bots, recent }) {
  const tile = (kind) => {
    const t = totals.find((r) => r.kind === kind) ?? {};
    return `<section class="tile"><h2>${TILE[kind]}</h2><p class="n">${t.total ?? 0}</p>
      <p class="sub">${t.week ?? 0} this week · ${t.month ?? 0} in 30 days</p></section>`;
  };
  const item = (e) => {
    const place = [e.city, e.country && countryName(e.country)].filter(Boolean);
    if (place[0] === place[1]) place.pop(); // Singapore, Singapore
    const from = e.kind !== "cv" ? null : !e.source ? (e.bot ? null : "a direct link") : e.source === "/" ? "your home page"
      : e.source.startsWith("/") ? `your ${e.source} page` : e.source;
    const what = e.bot ? `${esc(e.device)} ${e.kind === "cv" ? "fetched the CV" : "followed a QR link"}` : DID[e.kind];
    const meta = [place.join(", "), e.network, e.bot ? null : e.device, from && `from ${from}`].filter(Boolean).map(esc).join(" · ");
    return `<li${e.bot ? ' class="bot"' : ""}><p><strong>${what}</strong><span class="when">${whenFmt.format(e.ts)}</span></p>
      <p class="meta">${meta}</p></li>`;
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Stats · ethantam.dev</title>
<link rel="stylesheet" href="/fonts.css">
<style>
  :root { color-scheme: light dark; --ink: #1b1b19; --muted: #6d6c67; --line: #e3e1da; --bg: #faf9f6; }
  @media (prefers-color-scheme: dark) { :root { --ink: #ecebe7; --muted: #9b9a95; --line: #2d2d2a; --bg: #121211; } }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.5 Geist, system-ui, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 1.4rem; margin: 0 0 4px; }
  .lede, .meta, .note, .when, .sub, .tile h2 { color: var(--muted); }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin: 24px 0 32px; }
  .tile { border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; }
  .tile h2 { font-size: .85rem; font-weight: 500; margin: 0 0 6px; }
  .tile p { margin: 0; }
  .n { font-size: 2rem; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .sub, .when { font-size: .8rem; font-variant-numeric: tabular-nums; }
  h2.list { font-size: 1rem; margin: 0 0 8px; }
  ol { list-style: none; padding: 0; margin: 0; }
  li { border-top: 1px solid var(--line); padding: 10px 0; }
  li p { margin: 0; }
  .when { margin-left: 8px; }
  .meta { font-size: .875rem; overflow-wrap: anywhere; }
  .bot { opacity: .55; }
  .note { font-size: .8rem; margin-top: 28px; max-width: 62ch; }
</style>
</head>
<body>
<main>
  <h1>Who got the CV</h1>
  <p class="lede">${since ? `Counting since ${dateFmt.format(since)}.` : "Nothing counted yet."} Times are Singapore time.</p>
  <div class="tiles">${Object.keys(TILE).map(tile).join("")}</div>
  <h2 class="list">Latest</h2>
  ${recent.length ? `<ol>${recent.map(item).join("")}</ol>` : `<p class="meta">Nothing yet. A download or scan shows up here a few seconds after it happens.</p>`}
  <p class="note">The place and network come from the person's internet connection, not from them. A company or university
  name shows only when they were on its network; on mobile data or home Wi-Fi you'll see the provider (Singtel, StarHub, and
  so on), and the city can be a nearby one. The same person again within 30 minutes counts once. Your own downloads and
  scans count too. Faded rows are crawlers and link previews (Google, Bing, LinkedIn, WhatsApp...), left out of the totals:
  ${bots ?? 0} so far. Rows are kept for a year.</p>
</main>
</body>
</html>`;
}

async function stats(request, env) {
  const headers = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer" };
  const plain = (status, body, more = {}) =>
    new Response(body, { status, headers: { ...headers, "content-type": "text/plain; charset=utf-8", ...more } });
  if (!env.STATS_KEY) return plain(503, "Stats aren't set up: the Worker needs a STATS_KEY secret.");
  if (!(await allowed(request, env.STATS_KEY))) {
    return plain(401, "This page needs the password.", { "www-authenticate": 'Basic realm="ethantam.dev stats", charset="UTF-8"' });
  }
  const report = await env.STATS.get(env.STATS.idFromName("ethantam.dev")).report();
  return new Response(statsPage(report), {
    headers: {
      ...headers,
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": "default-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "x-content-type-options": "nosniff",
    },
  });
}

// ---------- the projects' status: is each app up, and when was it last worked on ----------

const PROJECTS = { // GitLab repo under eatentam -> the live app
  futuretracker: "https://futuretracker.ethantam.dev/",
  moneytracker: "https://20bucks.ethantam.dev/",
  eqmarkets: "https://markets.ethantam.dev/",
  thelist: "https://list.ethantam.dev/",
  oracular: "https://oracular.ethantam.dev/",
};
const UNLINKED = new Set(["oracular"]); // source not linked from the site: up or down only, no last commit

async function project([repo, site]) {
  const started = Date.now();
  const [ping, commit] = await Promise.all([
    fetch(site, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(8000) })
      .then((r) => { r.body?.cancel(); return { up: r.ok, status: r.status, ms: Date.now() - started }; })
      .catch(() => ({ up: false, status: 0, ms: null })),
    UNLINKED.has(repo) ? null : fetch(`https://gitlab.com/api/v4/projects/${encodeURIComponent(`eatentam/${repo}`)}/repository/commits?per_page=1`, { headers: { "user-agent": UA } })
      .then((r) => (r.ok ? r.json() : null))
      .then((list) => list?.[0] && { id: list[0].short_id, at: list[0].committed_date, title: list[0].title, url: list[0].web_url })
      .catch(() => null),
  ]);
  return [repo, { ...ping, commit }];
}

// ---------- one symbol's path for the ticker popover: today's session (in its own market's hours), the last 24 hours for a coin ----------

async function spark(s) {
  // a coin's last 24 hours comes from Yahoo too (Binance's REST refuses Cloudflare); the page draws the baseline from
  // the live 24h change, so it matches the number shown
  const coin = !!COINS[s];
  const r = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${coin ? `${s}-USD` : encodeURIComponent(YAHOO[s])}?${coin ? "range=2d&interval=15m" : "range=1d&interval=5m&includePrePost=true"}`,
    { headers: { "user-agent": UA } },
  );
  if (!r.ok) throw new Error(r.status);
  const res = (await r.json())?.chart?.result?.[0];
  const m = res?.meta;
  if (!m) throw new Error("no chart");
  const period = (name) => m.tradingPeriods?.[name]?.flat?.().at(-1) ?? m.currentTradingPeriod?.[name];
  const close = res.indicators?.quote?.[0]?.close ?? [];
  const points = (res.timestamp ?? []).map((t, i) => [t, close[i]]).filter(([, c]) => c != null).map(([t, c]) => [t, round(c, 4)]);
  if (coin) {
    const now = Math.round(Date.now() / 1000), day = points.filter(([t]) => t >= now - 86_400);
    return { s, prev: day[0]?.[1], start: now - 86_400, end: now, points: day };
  }
  const pre = period("pre"), reg = period("regular"), post = period("post");
  return {
    s, prev: m.chartPreviousClose ?? m.previousClose, points,
    start: pre?.start ?? points[0]?.[0], end: post?.end ?? points.at(-1)?.[0],
    regular: reg && [reg.start, reg.end],
  };
}

// Cache API at this data center: fresh for `ttl` seconds, plus a day-old copy for when the sources are down
async function cached(request, ctx, ttl, build) {
  const cache = caches.default;
  const key = new Request(request.url);
  const staleKey = new Request(`${request.url}${request.url.includes("?") ? "&" : "?"}stale`);
  const hit = await cache.match(key);
  if (hit) return hit;
  let why = null;
  const body = await build().catch((err) => { why = String(err); return null; });
  if (!body) return (await cache.match(staleKey)) ?? json({ error: "unavailable", why }, 503);
  const res = (age) => new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": `public, max-age=${age}` },
  });
  ctx.waitUntil(Promise.all([cache.put(key, res(ttl)), cache.put(staleKey, res(86_400))]));
  return res(ttl);
}

// ---------- the home page: "Last updated" comes from the deploy itself, not from a date typed by hand ----------

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Singapore" });

// The commit behind the live deploy: the newest on main as of the deploy's time, kept for a day per deploy. Every push to
// main deploys, and more than one pipeline does it, so the deploy's own tag isn't reliable.
async function deployedCommit(v, ctx) {
  if (!v.id || !v.timestamp) return null;
  const key = new Request(`https://ethantam.dev/api/version?commit=${v.id}`);
  const hit = await caches.default.match(key);
  if (hit) return (await hit.json()).id;
  const r = await fetch(
    `https://gitlab.com/api/v4/projects/${encodeURIComponent("eatentam/ethantam.dev")}/repository/commits?ref_name=main&per_page=1&until=${encodeURIComponent(v.timestamp)}`,
    { headers: { "user-agent": UA }, signal: AbortSignal.timeout(3000) },
  ).catch(() => null);
  const id = r?.ok ? (await r.json().catch(() => null))?.[0]?.short_id : null;
  if (id) ctx.waitUntil(caches.default.put(key, new Response(JSON.stringify({ id }), { headers: { "cache-control": "public, max-age=86400" } })));
  return id;
}

// The CV's only copy is the article with id="cv" in resume.html. The home page gets it too, hidden on screen,
// so printing the home page prints the CV.
async function cvArticle(request, env) {
  const res = await env.ASSETS.fetch(new Request(new URL("/resume", request.url), { headers: { accept: "text/html" } })).catch(() => null);
  if (!res?.ok) return null;
  return (await res.text()).match(/<article\b[^>]*\bid="cv"[^>]*>[\s\S]*?<\/article>/)?.[0] ?? null;
}

async function home(request, env, ctx) {
  const v = env.VERSION ?? {};
  // the page changes with every deploy even when index.html doesn't, so the deploy's id is the ETag
  const etag = v.id ? `"${v.id}"` : null;
  if (etag && request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { etag } });
  const [res, cv] = await Promise.all([
    env.ASSETS.fetch(new Request(request.url, { headers: { accept: "text/html" } })),
    cvArticle(request, env),
  ]);
  if (!res.ok || !res.headers.get("content-type")?.includes("text/html")) return res;
  const rewriter = new HTMLRewriter();
  if (cv) rewriter.on("[data-cv]", { element: (el) => el.replace(cv, { html: true }) });
  if (v.timestamp) {
    // just the date; the commit behind it is on /api/version
    const when = new Date(v.timestamp);
    const stamp = `<time datetime="${when.toISOString()}">${dateFmt.format(when)}</time>`;
    rewriter.on("[data-deploy]", { element: (el) => el.setInnerContent(stamp, { html: true }) });
  }
  const out = rewriter.transform(res);
  const headers = new Headers(out.headers);
  if (etag) headers.set("etag", etag);
  return new Response(out.body, { status: out.status, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // a QR code: count the scan, then on to the home page (a 302 that isn't cached, so every scan comes through here)
    const scan = QR[url.pathname];
    if (scan) {
      if (request.method === "GET") count(scan, request, url, env, ctx);
      return new Response(null, { status: 302, headers: { location: `${url.origin}/`, "cache-control": "no-store", "x-robots-tag": "noindex" } });
    }
    if (request.method !== "GET") return env.ASSETS.fetch(request);
    if (url.pathname === "/ethan-tam-cv.pdf") {
      // a PDF viewer can fetch the file in pieces; only the piece from the start is a download
      const range = request.headers.get("range");
      if (!range || /^bytes=0-/.test(range)) count("cv", request, url, env, ctx);
      return env.ASSETS.fetch(request);
    }
    if (url.pathname === "/stats") return stats(request, env);
    if (url.pathname === "/api/live" || url.pathname === "/api/quotes") {
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
    if (url.pathname === "/api/projects") {
      return cached(request, ctx, 120, async () => ({
        t: Date.now(),
        projects: Object.fromEntries(await Promise.all(Object.entries(PROJECTS).map(project))),
      }));
    }
    if (url.pathname === "/api/spark") {
      const s = url.searchParams.get("s");
      if (!ORDER.includes(s)) return json({ error: "unknown symbol" }, 404);
      return cached(new Request(`${url.origin}/api/spark?s=${s}`), ctx, 60, () => spark(s));
    }
    if (url.pathname === "/") return home(request, env, ctx);
    if (url.pathname === "/api/version") return json({ ...(env.VERSION ?? {}), commit: await deployedCommit(env.VERSION ?? {}, ctx) });
    return env.ASSETS.fetch(request);
  },
};
