(() => {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, el = document) => el.querySelector(s);

  /* ---------- clocks: Singapore and the UK ---------- */
  const clocks = [...document.querySelectorAll("[data-tz]")].map((el) => [
    el, new Intl.DateTimeFormat("en-GB", { timeZone: el.dataset.tz, hour: "2-digit", minute: "2-digit" }),
  ]);
  // GMT in winter, BST in summer
  const zoneNames = [...document.querySelectorAll("[data-tz-name]")].map((el) => [
    el, new Intl.DateTimeFormat("en-GB", { timeZone: el.dataset.tzName, timeZoneName: "short" }),
  ]);
  const tickClock = () => {
    const now = new Date();
    clocks.forEach(([el, fmt]) => { el.textContent = fmt.format(now); });
    zoneNames.forEach(([el, fmt]) => {
      el.textContent = fmt.formatToParts(now).find((p) => p.type === "timeZoneName")?.value ?? el.textContent;
    });
  };
  tickClock();
  setInterval(tickClock, 15_000);

  /* ---------- section nav (desktop): mark the section you're reading ---------- */
  const navLinks = [...document.querySelectorAll(".nav a, .tabbar a")];
  const sections = navLinks.map((a) => a.hash && $(a.hash)).filter((el, i, arr) => el && arr.indexOf(el) === i);
  let current = null;
  const setActive = (id) => {
    if (id === current) return;
    current = id;
    navLinks.forEach((a) => {
      const on = a.hash === `#${id}`;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    });
  };

  // The current section is the last one whose top has passed a reading line 40% down the window.
  // Background and Contact are short and sit at the end, so they can't all reach that line; over the
  // last 60% of a window's worth of scrolling the line slides to the bottom edge, giving each its turn
  // and lighting Contact at the bottom on any screen height.
  let lock = null, lockTimer = 0;
  const spy = () => {
    if (lock || !sections.length || !navLinks.some((a) => a.offsetParent)) return; // clicked item wins; runs wherever a nav surface is visible
    const h = innerHeight;
    const left = Math.max(0, document.documentElement.scrollHeight - h - scrollY);
    const line = Math.max(h * 0.4, h - left);
    let id = sections[0].id;
    for (const s of sections) if (s.getBoundingClientRect().top <= line) id = s.id;
    setActive(id);
  };
  let queued = false;
  const queueSpy = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; spy(); });
  };
  addEventListener("scroll", queueSpy, { passive: true });
  addEventListener("resize", queueSpy, { passive: true });

  // A clicked item stays lit while the page scrolls to it, even when the page is too short to bring
  // that section to the top. Any scrolling of your own hands control back to the reading line.
  const release = () => { lock = null; clearTimeout(lockTimer); };
  navLinks.forEach((a) => a.addEventListener("click", (e) => {
    // same-page anchor: use view transition for a smooth cross-fade
    if (a.hash && document.querySelector(a.hash) && "startViewTransition" in document) {
      e.preventDefault();
      document.startViewTransition(() => {
        document.querySelector(a.hash).scrollIntoView({ behavior: "instant" });
      });
    }
    release();
    lock = a.hash.slice(1);
    setActive(lock);
    lockTimer = setTimeout(release, 1200);
  }));
  document.addEventListener("scrollend", release);
  for (const type of ["wheel", "touchstart", "keydown"]) addEventListener(type, release, { passive: true });
  spy();

  /* ---------- spotlight: a soft glow under the pointer (desktop only) ---------- */
  const spot = $(".spotlight");
  if (spot && !reduceMotion && matchMedia("(hover: hover) and (pointer: fine)").matches) {
    let raf = 0, px = 0, py = 0;
    addEventListener("pointermove", (e) => {
      px = e.clientX; py = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        spot.style.setProperty("--x", `${px}px`);
        spot.style.setProperty("--y", `${py}px`);
        raf = 0;
      });
    }, { passive: true });
  }

  /* ---------- ticker ---------- */
  // What's on the list and why: [name, the reason]. Tap a price to read it. The order here is the order on the strip.
  const WATCH = {
    BTC: ["Bitcoin", "The one market that never closes, so it's my read on risk appetite at 3am, before anything else opens."],
    ETH: ["Ether", "Crypto's second engine. When it outruns Bitcoin, people are reaching for risk; when it lags, they're hiding in the big one."],
    SOL: ["Solana", "The high-beta end of crypto: it runs furthest in a melt-up and falls hardest when the tide goes out."],
    AXTI: ["AXT Inc", "A small maker of the indium phosphide wafers under optical AI networking, with its factories in China, so export rules move it as much as earnings do."],
    MU: ["Micron", "Memory is the most cyclical corner of chips. High-bandwidth memory for AI is the test of whether this cycle is different."],
    NBIS: ["Nebius", "An AI cloud spun out of Yandex, and one of the cleanest bets on whether renting out GPUs stays a good business."],
    CRWV: ["CoreWeave", "The biggest pure-play GPU cloud, built on a lot of debt. If AI spending wobbles, I'd expect to see it here first."],
    LLY: ["Eli Lilly", "GLP-1 drugs turned a pharma company into a growth stock. I'm watching how long it can be priced like one."],
    GS: ["Goldman Sachs", "Dealmaking and trading in one ticker. When IPOs and M&A come back, it tends to show up here before the headlines."],
    IBKR: ["Interactive Brokers", "A broker that wins by being cheap and boring. Its monthly account numbers are a live read on how hard retail is trading."],
    NVDA: ["NVIDIA", "The AI trade in one stock. Its earnings move the whole market, not just chips."],
    CRWD: ["CrowdStrike", "Security is the last budget companies cut. It also had the outage of the decade in 2024 and kept its customers."],
    NET: ["Cloudflare", "This site runs on it. It's also a bet that more of the internet's code ends up running at the edge."],
    CAT: ["Caterpillar", "The old economy's order book: construction, mining, and now the generators going into data centres."],
    TWLO: ["Twilio", "Paid per message sent, so its usage is an early read on whether software customers are growing or trimming."],
  };
  const WATCHLIST = Object.keys(WATCH);
  const COINS = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana" };
  const SESSIONS = { pre: "pre-market", ah: "after hours" };
  const PX_PER_SEC = 45;
  const POLL_MS = 5_000;
  const quotes = new Map(WATCHLIST.map((s) => [s, { s }]));

  const fmtPx = (n) => n >= 1000
    ? n.toLocaleString("en-US", { maximumFractionDigits: 0 })
    : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtChg = (c) => `${c >= 0 ? "▲" : "▼"} ${Math.abs(c).toFixed(1)}%`;
  const ticker = $(".ticker");
  const track = $("#ticker");
  // Build the strip once. The first copy is buttons; the second only makes the CSS loop (translate -50%) seamless,
  // so it stays out of the tab order and away from screen readers. After that only the numbers inside change,
  // so the scroll never restarts.
  const item = (s, tag, attrs) => `<${tag} class="tk" data-s="${s}" ${attrs}><b>${s}</b><span class="tk__p">…</span><i></i><small></small></${tag}>`;
  track.innerHTML = WATCHLIST.map((s) => item(s, "button", `type="button" aria-haspopup="dialog" aria-expanded="false" aria-describedby="why-${s}"`)).join("")
    + WATCHLIST.map((s) => item(s, "span", `aria-hidden="true"`)).join("");
  // the reasons, for screen readers; the popover shows them on screen
  const reasons = document.createElement("div");
  reasons.hidden = true;
  reasons.append(...WATCHLIST.map((s) => Object.assign(document.createElement("span"), { id: `why-${s}`, textContent: WATCH[s][1] })));
  document.body.append(reasons);
  const cells = new Map(WATCHLIST.map((s) => [s, [...track.querySelectorAll(`[data-s="${s}"]`)]]));
  const painted = new Map(); // the price on screen, so a change can flash up or down
  const dirty = new Set();
  let paintRaf = 0, speedSet = false, popS = null;

  const paint = () => {
    paintRaf = 0;
    let css;
    for (const s of dirty) {
      const { p, c, x } = quotes.get(s);
      const px = typeof p === "number" ? fmtPx(p) : "…";
      const was = painted.get(s);
      const tone = typeof was === "number" && fmtPx(was) !== px ? (p > was ? "--up" : "--down") : null;
      painted.set(s, p);
      for (const el of cells.get(s)) {
        const [, pEl, cEl, xEl] = el.children;
        pEl.textContent = px;
        cEl.className = typeof c === "number" ? (c >= 0 ? "up" : "dn") : "";
        cEl.textContent = typeof c === "number" ? fmtChg(c) : "";
        xEl.textContent = x ?? "";
        if (tone) {
          css ??= getComputedStyle(document.documentElement);
          pEl.animate?.([{ color: css.getPropertyValue(tone).trim(), offset: 0 }], { duration: 1200, easing: "ease-out" });
        }
      }
      const chg = typeof c === "number" ? `, ${c >= 0 ? "up" : "down"} ${Math.abs(c).toFixed(1)}%` : "";
      cells.get(s)[0].setAttribute("aria-label", `${WATCH[s][0]}: ${px}${chg}${x ? `, ${SESSIONS[x]}` : ""}`);
      if (s === popS) drawPop();
    }
    dirty.clear();
    if (!speedSet && painted.size) {
      track.style.animationDuration = `${Math.round(track.scrollWidth / 2 / PX_PER_SEC)}s`;
      speedSet = true;
    }
  };
  // newest wins, so a slow snapshot never undoes a tick that already streamed in
  const merge = (list) => {
    for (const q of list ?? []) {
      const cur = quotes.get(q.s);
      if (!cur || typeof q.p !== "number" || q.t < cur.t) continue;
      quotes.set(q.s, q);
      dirty.add(q.s);
    }
    if (dirty.size && !paintRaf) paintRaf = requestAnimationFrame(paint);
  };

  // Tap a price: why it's on the list, and its path today (a stock's session in New York, or a coin's last 24 hours),
  // with the live price as the last point and the dashed line at the price the change is measured from.
  const pop = $("#tkpop");
  const popEl = {
    s: $("#tkpop-s"), name: $(".tkpop__name", pop), px: $(".tkpop__px", pop), cap: $(".tkpop__cap", pop),
    why: $(".tkpop__text", pop), reg: $(".tkpop__reg", pop), base: $(".tkpop__base", pop), line: $(".tkpop__line", pop),
  };
  const sparks = new Map(); // symbol -> { at, data }, kept for a minute
  const SW = 300, SH = 64, SPAD = 5;
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "America/New_York" });
  const drawPop = () => {
    const s = popS;
    const { p, c, x, t } = quotes.get(s);
    popEl.s.textContent = s;
    popEl.name.textContent = WATCH[s][0];
    popEl.px.innerHTML = typeof p === "number"
      ? `${fmtPx(p)}${typeof c === "number" ? ` <i class="${c >= 0 ? "up" : "dn"}">${fmtChg(c)}</i>` : ""}`
      : "…";
    pop.classList.toggle("is-down", typeof c === "number" && c < 0);
    const got = sparks.get(s);
    if (!got?.data) {
      popEl.line.setAttribute("d", "");
      popEl.reg.setAttribute("width", 0);
      popEl.base.setAttribute("visibility", "hidden");
      popEl.cap.textContent = got ? "No chart right now." : "Loading the chart…";
      return;
    }
    const d = got.data;
    const pts = d.points.slice();
    const now = (t ?? Date.now()) / 1000;
    if (typeof p === "number" && (!pts.length || now > pts.at(-1)[0])) pts.push([now, p]);
    if (!pts.length) return;
    const x0 = d.start, x1 = Math.max(d.end, pts.at(-1)[0]);
    const vals = pts.map(([, v]) => v).concat(d.prev ?? []);
    const lo = Math.min(...vals), span = Math.max(...vals) - lo || 1;
    const X = (tt) => ((tt - x0) / (x1 - x0 || 1)) * SW;
    const Y = (v) => SPAD + (1 - (v - lo) / span) * (SH - 2 * SPAD);
    popEl.line.setAttribute("d", pts.map(([tt, v], i) => `${i ? "L" : "M"}${X(tt).toFixed(1)} ${Y(v).toFixed(1)}`).join(""));
    popEl.base.setAttribute("visibility", d.prev ? "visible" : "hidden");
    if (d.prev) ["y1", "y2"].forEach((a) => popEl.base.setAttribute(a, Y(d.prev).toFixed(1)));
    popEl.reg.setAttribute("x", d.regular ? X(d.regular[0]).toFixed(1) : 0);
    popEl.reg.setAttribute("width", d.regular ? Math.max(0, X(d.regular[1]) - X(d.regular[0])).toFixed(1) : 0);
    popEl.cap.textContent = COINS[s]
      ? `Last 24 hours · 24h ago ${fmtPx(d.prev)}`
      : `${Date.now() / 1000 < d.end ? "Today in New York" : `${weekday.format(d.start * 1000)}'s session`}${x ? ` · ${SESSIONS[x]}` : ""} · prev close ${fmtPx(d.prev)}`;
  };
  const closePop = () => {
    if (!popS) return;
    cells.get(popS)[0].setAttribute("aria-expanded", "false");
    pop.classList.remove("is-open");
    ticker.classList.remove("is-open");
    popS = null;
  };
  let popAt = null; // the item the card hangs under
  const placePop = () => {
    if (!popS) return;
    const r = popAt.getBoundingClientRect(), w = pop.offsetWidth, vw = document.documentElement.clientWidth;
    pop.style.left = `${Math.round(Math.min(Math.max(16, r.left + r.width / 2 - w / 2), vw - w - 16))}px`;
    pop.style.top = `${Math.round(ticker.getBoundingClientRect().bottom + 8)}px`;
  };
  const openPop = (s, el) => {
    closePop();
    popS = s;
    popAt = el;
    popEl.why.textContent = WATCH[s][1];
    cells.get(s)[0].setAttribute("aria-expanded", "true");
    pop.classList.add("is-open");
    ticker.classList.add("is-open"); // the strip holds still while the card is open
    drawPop();
    placePop();
    const have = sparks.get(s);
    if (have && Date.now() - have.at < 60_000) return;
    fetch(`/api/spark?s=${s}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.status))))
      .then((data) => data, () => null)
      .then((data) => { sparks.set(s, { at: Date.now(), data }); if (popS === s) drawPop(); });
  };
  track.addEventListener("click", (e) => {
    const el = e.target.closest(".tk[data-s]");
    if (!el) return;
    if (popS === el.dataset.s) closePop();
    else openPop(el.dataset.s, el);
  });
  document.addEventListener("click", (e) => { if (popS && !e.target.closest(".tkpop, .ticker__track")) closePop(); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !popS) return;
    const btn = cells.get(popS)[0];
    closePop();
    btn.focus();
  });
  addEventListener("resize", closePop);
  // the strip scrolls when a focused item is brought into view, or by hand under reduced motion: the card follows
  $(".ticker__viewport").addEventListener("scroll", placePop, { passive: true });

  // Live: a WebSocket to /api/live, where one Durable Object (worker/index.js) streams Yahoo for the stocks and
  // Binance for the crypto to every visitor. Until it connects, or while it's down, poll /api/quotes every 5s;
  // on a plain static preview with no Worker, CoinGecko for the crypto only.
  const fromApi = async () => {
    const r = await fetch("/api/quotes", { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    const { quotes: q } = await r.json();
    if (!q?.some((x) => typeof x.p === "number")) throw new Error("empty");
    return q;
  };
  const fromCoinGecko = async () => {
    const ids = Object.values(COINS).join(",");
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`);
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    return Object.entries(COINS).filter(([, id]) => d[id]).map(([s, id]) => ({ s, p: d[id].usd, c: d[id].usd_24h_change, t: d[id].last_updated_at * 1000 }));
  };

  let sock = null, heard = 0, tries = 0, polling = false, pollTimer = 0, retryTimer = 0, sleepTimer = 0;
  const isLive = () => sock?.readyState === 1; // OPEN
  const poll = async () => {
    if (polling) return;
    polling = true;
    clearTimeout(pollTimer);
    try { merge(await fromApi()); }
    catch { try { merge(await fromCoinGecko()); } catch { /* keep last */ } }
    finally { polling = false; }
    // keep polling only while there's no socket and someone is looking
    if (!isLive() && !document.hidden) pollTimer = setTimeout(poll, POLL_MS);
  };
  // forget the socket now rather than wait out a dead one's close handshake
  const drop = () => {
    const ws = sock;
    sock = null;
    ticker.classList.remove("is-live");
    if (ws) { ws.onclose = ws.onmessage = null; try { ws.close(); } catch { /* already gone */ } }
  };
  const connect = () => {
    clearTimeout(retryTimer);
    if (sock || document.hidden || !("WebSocket" in window)) return;
    const ws = sock = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/live`);
    ws.onopen = () => { tries = 0; heard = Date.now(); ticker.classList.add("is-live"); };
    ws.onmessage = (e) => {
      heard = Date.now();
      try { merge(JSON.parse(e.data).quotes); } catch { /* skip a bad frame */ }
    };
    ws.onclose = () => {
      if (sock !== ws) return;
      drop();
      if (document.hidden) return; // picked up again when the page is visible
      poll();
      retryTimer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** tries++));
    };
  };
  const resume = () => {
    if (document.hidden || (sock && sock.readyState <= 1)) return; // connecting or open
    drop();
    poll();
    connect();
  };
  // the hub sends a heartbeat every 10s; silence for longer means the connection died without saying so
  setInterval(() => { if (isLive() && Date.now() - heard > 25_000) { drop(); resume(); } }, 5_000);
  // a hidden tab lets go after a minute so the hub can sleep, and catches up the moment it's back
  document.addEventListener("visibilitychange", () => {
    clearTimeout(sleepTimer);
    if (document.hidden) sleepTimer = setTimeout(drop, 60_000);
    else resume();
  });
  addEventListener("online", () => { drop(); resume(); });
  addEventListener("pageshow", (e) => { if (e.persisted) resume(); });
  poll();
  connect();

  /* ---------- projects: is each app up, and when was it last worked on ---------- */
  // from /api/projects (worker/index.js): the Worker loads each app and reads its last commit on GitLab, every 2 minutes
  const statuses = [...document.querySelectorAll(".card__status[data-project]")];
  if (statuses.length) {
    const rel = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    const UNITS = [["year", 31_536_000], ["month", 2_592_000], ["week", 604_800], ["day", 86_400], ["hour", 3_600], ["minute", 60]];
    const ago = (iso) => {
      const sec = (Date.parse(iso) - Date.now()) / 1000;
      const [unit, n] = UNITS.find(([, n]) => Math.abs(sec) >= n) ?? [];
      return unit ? rel.format(Math.round(sec / n), unit) : "just now";
    };
    const span = (cls, text) => Object.assign(document.createElement("span"), { className: cls, textContent: text });
    fetch("/api/projects")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then(({ t, projects }) => {
        const checked = new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        for (const el of statuses) {
          const p = projects?.[el.dataset.project];
          if (!p) continue;
          const state = span("card__state", p.up ? `Live${p.ms ? ` · ${p.ms} ms` : ""}` : `Down right now${p.status ? ` (HTTP ${p.status})` : ""}`);
          state.prepend(Object.assign(document.createElement("span"), { className: p.up ? "dot" : "dot dot--down" }));
          state.title = `Checked from Cloudflare at ${checked}`;
          el.replaceChildren(state);
          if (p.commit) {
            const link = Object.assign(document.createElement("a"), {
              href: p.commit.url, target: "_blank", rel: "noopener noreferrer",
              textContent: `last commit ${ago(p.commit.at)}`, title: `${p.commit.id}: ${p.commit.title}`,
            });
            const commit = span("card__commit", "");
            commit.append(span("dim", "·"), link); // the dot travels with the link when the line wraps
            el.append(commit);
          }
          el.hidden = false;
        }
      })
      .catch(() => { /* no status beats a wrong one */ });
  }

  /* ---------- print: the page prints as a one-page CV (see @media print in styles.css) ---------- */
  document.querySelectorAll("[data-print]").forEach((btn) => btn.addEventListener("click", () => window.print()));

  /* ---------- dithered painting ---------- */
  const art = $("#art");
  const frame = $(".art__frame", art);
  const img = $("img", art);
  const canvas = $("canvas", art);

  const dither = () => {
    try {
      const W = 300;
      const H = Math.round(W * img.naturalHeight / img.naturalWidth);
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, W, H);
      const src = ctx.getImageData(0, 0, W, H);

      // luminance with a contrast lift, then Floyd–Steinberg error diffusion
      const lum = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) {
        const p = i * 4;
        const l = (0.299 * src.data[p] + 0.587 * src.data[p + 1] + 0.114 * src.data[p + 2]) / 255;
        lum[i] = Math.min(1, Math.max(0, (l - 0.5) * 1.3 + 0.48));
      }
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          const on = lum[i] > 0.5 ? 1 : 0;
          const err = lum[i] - on;
          lum[i] = on;
          if (x + 1 < W) lum[i + 1] += err * 7 / 16;
          if (y + 1 < H) {
            if (x > 0) lum[i + W - 1] += err * 3 / 16;
            lum[i + W] += err * 5 / 16;
            if (x + 1 < W) lum[i + W + 1] += err * 1 / 16;
          }
        }
      }

      const out = ctx.createImageData(W, H);
      // read theme-aware colors from CSS custom properties
      const cs = getComputedStyle(root);
      const accentHex = cs.getPropertyValue("--accent").trim() || "#f2a93b";
      const bgHex = cs.getPropertyValue("--bg").trim() || "#0c0b0a";
      const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
      const [ar, ag, ab] = hex(accentHex);
      const [br, bg, bb] = hex(bgHex);
      for (let i = 0; i < W * H; i++) {
        const p = i * 4, on = lum[i] > 0.5;
        out.data[p] = on ? ar : br;
        out.data[p + 1] = on ? ag : bg;
        out.data[p + 2] = on ? ab : bb;
        out.data[p + 3] = 255;
      }

      if (reduceMotion) { ctx.putImageData(out, 0, 0); return; }

      // scan the dithered image in from top to bottom
      ctx.fillStyle = bgHex;
      ctx.fillRect(0, 0, W, H);
      let row = 0;
      const step = () => {
        row = Math.min(H, row + 6);
        ctx.putImageData(out, 0, 0, 0, 0, W, row);
        if (row < H) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    } catch {
      // canvas tainted (e.g. opened via file://) or unsupported: show the real painting
      art.classList.add("no-dither");
    }
  };
  // pay for the dither pass only once the painting is near the viewport (on phones it starts below the fold)
  const startDither = () => {
    if (img.complete && img.naturalWidth) dither();
    else if (img.complete) art.classList.add("no-dither"); // failed before this script ran
    else img.addEventListener("load", dither, { once: true });
  };
  img.addEventListener("error", () => art.classList.add("no-dither"));
  if ("IntersectionObserver" in window) {
    const seen = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { seen.disconnect(); startDither(); }
    }, { rootMargin: "25% 0px" });
    seen.observe(art);
  } else {
    startDither();
  }

  frame.addEventListener("click", () => {
    const plain = art.classList.toggle("is-plain");
    frame.setAttribute("aria-pressed", String(plain));
  });

  /* ---------- terminal ---------- */
  const term = $("#term");
  const out = $("#term-out");
  const input = $("#term-input");
  const history = [];
  let hIdx = 0;
  let opener = null;

  const LINKS = {
    gitlab: "https://gitlab.com/eatentam",
    linkedin: "https://linkedin.com/in/ethantam-",
    "20bucks": "https://20bucks.ethantam.dev",
    list: "https://list.ethantam.dev",
    markets: "https://markets.ethantam.dev",
    journal: "https://futuretracker.ethantam.dev/?demo",
    oracular: "https://oracular.ethantam.dev",
  };
  const a = (href, text = href) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
  const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

  const MOTD = String.raw`
    _ _
   ( V )     ethantam.dev
    \ /      type help
  \  |  /
   \ | /
     |`.slice(1);

  const COMMANDS = {
    help: () => [
      "help        this list",
      "about       who I am",
      "now         what I'm up to",
      "projects    what I've built",
      "record      background, briefly",
      "watchlist   prices I check too often, live",
      "why &lt;x&gt;     why a ticker is on the list, e.g. why nvda",
      "cv          print a one-page CV",
      "contact     how to reach me",
      "open &lt;x&gt;    open gitlab | linkedin | 20bucks | list | markets | journal | oracular",
      "tulip       a cautionary tale",
      "clear       clear the screen",
      "exit        close (or press esc)",
    ].join("\n"),
    now: () => `National Service as a transport operator until Feb 2027.\nOn the side: finance and content at ${a("https://www.advisory.sg", "Advisory Singapore")}, and whatever I'm fixing in 20bucks this week.\nThen Economics, from Oct 2027.`,
    ns: () => "still serving as a transport operator. back in Feb 2027.",
    makan: () => `hungry? ${a(LINKS.list, "list.ethantam.dev")} has opinions.`,
    hire: () => COMMANDS.contact(),
    about: () => "Ethan Tam, Singapore.\nDoing National Service now, Economics at Cambridge from 2027.\nI build small tools that make markets legible.",
    projects: () => [
      `Journal     futures trade journal: R multiples, what mistakes cost    ${a(LINKS.journal, "demo")} ${a("https://gitlab.com/eatentam/futuretracker", "src")}`,
      `20bucks     personal finance PWA: splits, PayLater, P&L, AI review   ${a(LINKS["20bucks"], "app")} ${a("https://gitlab.com/eatentam/moneytracker", "src")}`,
      `Markets     macro dashboard: risk, regime, absorption, recession     ${a(LINKS.markets, "app")} ${a("https://gitlab.com/eatentam/eqmarkets", "src")}`,
      `The List    ratings, leaderboard, auto want list, Telegram bot       ${a(LINKS.list, "app")} ${a("https://gitlab.com/eatentam/thelist", "src")}`,
      `Oracular    research terminal: council votes, seasonality, options   ${a(LINKS.oracular, "app")}`,
      `Tally       escrow trust layer: Cardano, evidence, reliability       ${a("https://github.com/xiaoyang4c/actual-token2049-hackathon-repo", "src")}`,
    ].join("\n"),
    record: () => [
      "2027     Economics (BA), University of Cambridge",
      "2026–    Finance & Content, Advisory Singapore",
      "2025–27  National Service · Transport Operator, Singapore Armed Forces",
      "2023–24  Co-founder, ACSians Investment Club",
      "2023–24  Co-founder, Project Lumos",
    ].join("\n"),
    contact: () => `email     ${a("mailto:eatentam@gmail.com", "eatentam@gmail.com")}\ngitlab    ${a(LINKS.gitlab, "eatentam")}\nlinkedin  ${a(LINKS.linkedin, "ethantam-")}`,
    open: (arg) => {
      const url = LINKS[arg];
      if (!url) return `open: unknown target "${esc(arg || "")}". try: ${Object.keys(LINKS).join(", ")}`;
      window.open(url, "_blank", "noopener");
      return `opening ${arg}…`;
    },
    watchlist: () => [...quotes.values()].map((q) => {
      const px = typeof q.p === "number" ? fmtPx(q.p) : "…";
      const chg = typeof q.c === "number" ? `<span class="${q.c >= 0 ? "up" : "dn"}">${q.c >= 0 ? "+" : ""}${q.c.toFixed(2)}%</span>` : "";
      return `${q.s.padEnd(6)}${px.padStart(10)}   ${chg}${q.x ? ` <span class="dim">${SESSIONS[q.x]}</span>` : ""}`;
    }).join("\n") + "\n\nnot financial advice. see also: tulip",
    why: (arg) => {
      const s = arg.toUpperCase();
      if (!WATCH[s]) return `why: pick one of ${WATCHLIST.join(" ").toLowerCase()}`;
      return `${s}  ${WATCH[s][0]}\n${esc(WATCH[s][1])}`;
    },
    cv: () => {
      setTimeout(() => window.print(), 50);
      return "opening the print dialog. save it as a PDF for a one-page CV.";
    },
    tulip: () => "Feb 1637: a single Semper Augustus bulb was quoted at more than a house on an\nAmsterdam canal. A few weeks later, buyers stopped showing up.\nThe painting on the front page is from about 20 years before the peak.",
    ls: () => "about  now  projects  record  watchlist  contact  tulip",
    whoami: () => "guest. but you could be a friend: try `contact`",
    sudo: () => "nice try.",
    clear: () => { out.innerHTML = ""; return null; },
    exit: () => { closeTerm(); return null; },
  };

  const print = (cmd, res) => {
    const c = document.createElement("div");
    c.className = "cmd"; c.textContent = cmd;
    out.append(c);
    if (res != null) {
      const r = document.createElement("div");
      r.className = "res"; r.innerHTML = res;
      out.append(r);
    }
    out.scrollTop = out.scrollHeight;
  };

  const run = (raw) => {
    const line = raw.trim();
    if (!line) return;
    history.push(line); hIdx = history.length;
    const [name, ...args] = line.split(/\s+/);
    const fn = COMMANDS[name.toLowerCase()];
    const res = fn ? fn(args.join(" ").toLowerCase()) : `command not found: ${esc(name)}. type \`help\``;
    if (name.toLowerCase() !== "clear") print(line, res);
  };

  // everything except the terminal goes inert while it's open, so focus and screen readers stay inside
  const background = [...document.body.children].filter((el) => el !== term && el.tagName !== "SCRIPT");
  const setInert = (on) => background.forEach((el) => { el.inert = on; });

  const openTerm = () => {
    if (!term.hidden) return;
    opener = document.activeElement;
    term.hidden = false;
    setInert(true);
    document.body.style.overflow = "hidden";
    if (!out.childElementCount) {
      const m = document.createElement("div");
      m.className = "res motd"; m.textContent = MOTD;
      out.append(m);
    }
    input.focus();
  };
  const closeTerm = () => {
    term.hidden = true;
    setInert(false);
    document.body.style.overflow = "";
    opener?.focus?.();
  };

  // focus trap: the only focusables are the input and the close button
  const closeBtn = $(".term__x", term);
  term.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    if (e.shiftKey && document.activeElement === input) { e.preventDefault(); closeBtn.focus(); }
    else if (!e.shiftKey && document.activeElement === closeBtn) { e.preventDefault(); input.focus(); }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); run(input.value); input.value = ""; }
    if (e.key === "ArrowUp" && hIdx > 0) { input.value = history[--hIdx]; e.preventDefault(); }
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const [cmd, arg] = input.value.trimStart().split(/\s+/, 2);
      const pool = arg !== undefined ? Object.keys(LINKS).map((k) => `${cmd} ${k}`) : Object.keys(COMMANDS);
      const hits = pool.filter((c) => c.startsWith(input.value.trimStart().toLowerCase()));
      if (hits.length === 1) input.value = hits[0] + (hits[0] === "open" ? " " : "");
      else if (hits.length > 1) print(input.value, hits.join("  "));
    }
    if (e.key === "ArrowDown") { hIdx = Math.min(history.length, hIdx + 1); input.value = history[hIdx] ?? ""; e.preventDefault(); }
  });
  document.querySelectorAll("[data-open-term]").forEach((b) => b.addEventListener("click", openTerm));
  document.querySelectorAll("[data-close-term]").forEach((b) => b.addEventListener("click", closeTerm));
  term.addEventListener("click", (e) => { if (e.target === term) closeTerm(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !term.hidden) { closeTerm(); return; }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
    if ((e.key === "~" || e.key === "`") && !typing) { e.preventDefault(); openTerm(); }
  });


  /* ---------- theme toggle ---------- */
  const root = document.documentElement;
  const themeBtns = document.querySelectorAll("[data-toggle-theme]");
  const isLight = () => root.dataset.theme === "light" ||
    (!root.dataset.theme && matchMedia("(prefers-color-scheme: light)").matches);
  const updateThemeBtns = () => {
    const light = isLight();
    themeBtns.forEach((b) => b.setAttribute("aria-pressed", String(light)));
  };
  const toggleTheme = (e) => {
    const light = isLight();
    const next = light ? "dark" : "light";
    const apply = () => {
      root.dataset.theme = next;
      try { localStorage.setItem("theme", next); } catch {}
      updateThemeBtns();
      // re-dither the painting in the new theme colors
      if (typeof dither === "function" && img.complete && img.naturalWidth) dither();
    };
    // dawn rises from the bottom, dusk settles from the top; without the API the theme just flips
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduce) { apply(); return; }
    const toLight = next === "light";
    root.classList.add("theme-wipe");
    const band = document.createElement("div");
    band.className = "theme-band " + (toLight ? "theme-band--dawn" : "theme-band--dusk");
    band.setAttribute("aria-hidden", "true");
    document.body.append(band);
    band.animate(
      [
        { transform: toLight ? "translateY(100vh)" : "translateY(-100%)", opacity: 1 },
        { transform: toLight ? "translateY(-100%)" : "translateY(100vh)", opacity: 0 },
      ],
      { duration: 560, easing: "cubic-bezier(.16, 1, .3, 1)" }
    );
    const vt = document.startViewTransition(apply);
    vt.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [toLight ? "inset(100% 0 0 0)" : "inset(0 0 100% 0)", "inset(0 0 0 0)"] },
        { duration: 480, easing: "cubic-bezier(.16, 1, .3, 1)", pseudoElement: "::view-transition-new(root)" }
      );
    }).finally(() => {
      root.classList.remove("theme-wipe");
      band.remove();
    });
  };
  themeBtns.forEach((b) => b.addEventListener("click", toggleTheme));
  updateThemeBtns();
  // listen for system theme changes when no explicit preference is set
  matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
    if (!root.dataset.theme) {
      updateThemeBtns();
      if (typeof dither === "function" && img.complete && img.naturalWidth) dither();
    }
  });

  /* ---------- phones: project details expand inline, the hook stays visible ---------- */
  document.querySelectorAll(".card").forEach((card) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card__more mono";
    btn.setAttribute("aria-expanded", "false");
    btn.textContent = "details";
    btn.addEventListener("click", () => {
      const open = card.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(open));
      btn.textContent = open ? "close" : "details";
    });
    card.querySelector(".card__body").append(btn);
  });

  /* ---------- copy email button ---------- */
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const text = btn.dataset.copy;
      try {
        await navigator.clipboard.writeText(text);
        const original = btn.textContent;
        btn.textContent = "Copied!";
        btn.classList.add("copied");
        setTimeout(() => { btn.textContent = original; btn.classList.remove("copied"); }, 2000);
      } catch {
        // clipboard API unavailable (e.g. non-secure context): fall back to execCommand
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.append(ta); ta.select();
        try { document.execCommand("copy"); btn.textContent = "Copied!"; btn.classList.add("copied");
          setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 2000);
        } catch { btn.textContent = text; }
        ta.remove();
      }
    });
  });

  /* ---------- service worker (offline support) ---------- */
  if ("serviceWorker" in navigator) {
    addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => { /* fail silently */ });
    });
  }

})();
