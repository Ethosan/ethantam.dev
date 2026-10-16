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
  const navLinks = [...document.querySelectorAll(".nav a")];
  const sections = navLinks.map((a) => $(a.hash)).filter(Boolean);
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
    if (lock || !sections.length || !navLinks[0].offsetParent) return; // clicked item wins; nav hidden on phones
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
  navLinks.forEach((a) => a.addEventListener("click", () => {
    release();
    lock = a.hash.slice(1);
    setActive(lock);
    lockTimer = setTimeout(release, 1200); // fallback where scrollend isn't supported
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
  const WATCHLIST = ["BTC", "ETH", "SOL", "AXTI", "MU", "NBIS", "CRWV", "LLY", "GS", "IBKR", "NVDA", "CRWD", "NET", "CAT", "TWLO"];
  const COINS = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana" };
  const PX_PER_SEC = 45;
  let quotes = WATCHLIST.map((s) => ({ s }));

  const fmtPx = (n) => n >= 1000
    ? n.toLocaleString("en-US", { maximumFractionDigits: 0 })
    : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const itemInner = ({ s, p, c }) => {
    const val = typeof p === "number" ? fmtPx(p) : "—";
    const chg = typeof c === "number"
      ? ` <i class="${c >= 0 ? "up" : "dn"}">${c >= 0 ? "▲" : "▼"} ${Math.abs(c).toFixed(1)}%</i>`
      : "";
    return `<b>${s}</b>${val}${chg}`;
  };
  const track = $("#ticker");
  // Build the strip once (two copies so the CSS loop can translate -50% seamlessly),
  // then only swap the numbers inside it, so the scroll never restarts.
  track.innerHTML = [0, 1].map(() => WATCHLIST.map((s) => `<span class="tk" data-s="${s}"></span>`).join("")).join("");
  let speedSet = false;
  const renderTicker = () => {
    for (const q of quotes) {
      track.querySelectorAll(`[data-s="${q.s}"]`).forEach((el) => { el.innerHTML = itemInner(q); });
    }
    if (!speedSet && quotes.some((q) => typeof q.p === "number")) {
      track.style.animationDuration = `${Math.round(track.scrollWidth / 2 / PX_PER_SEC)}s`;
      speedSet = true;
    }
  };

  // Primary: our own /api/quotes (the Worker in worker/index.js, stocks + crypto, edge-cached 60s).
  // Fallback for local preview or if Yahoo is down: CoinGecko for the crypto only.
  const fromApi = async () => {
    const r = await fetch("/api/quotes", { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    const { quotes: q } = await r.json();
    if (!q?.some((x) => typeof x.p === "number")) throw new Error("empty");
    return q;
  };
  const fromCoinGecko = async () => {
    const ids = Object.values(COINS).join(",");
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`);
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    return WATCHLIST.map((s) => COINS[s] && d[COINS[s]] ? { s, p: d[COINS[s]].usd, c: d[COINS[s]].usd_24h_change } : { s });
  };
  const loadQuotes = async () => {
    try { quotes = await fromApi(); }
    catch { try { quotes = await fromCoinGecko(); } catch { /* keep last */ } }
    renderTicker();
  };
  renderTicker();
  loadQuotes();
  setInterval(loadQuotes, 60_000);

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
      const [ar, ag, ab] = [242, 169, 59];   // --accent
      const [br, bg, bb] = [12, 11, 10];     // --bg
      for (let i = 0; i < W * H; i++) {
        const p = i * 4, on = lum[i] > 0.5;
        out.data[p] = on ? ar : br;
        out.data[p + 1] = on ? ag : bg;
        out.data[p + 2] = on ? ab : bb;
        out.data[p + 3] = 255;
      }

      if (reduceMotion) { ctx.putImageData(out, 0, 0); return; }

      // scan the dithered image in from top to bottom
      ctx.fillStyle = `rgb(${br},${bg},${bb})`;
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
  const form = $("#term-form");
  const input = $("#term-input");
  const history = [];
  let hIdx = 0;
  let opener = null;

  const LINKS = {
    github: "https://github.com/Ethosan",
    linkedin: "https://linkedin.com/in/ethantam-",
    "20bucks": "https://20bucks.ethantam.dev",
    list: "https://list.ethantam.dev",
    markets: "https://markets.ethantam.dev",
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
      "contact     how to reach me",
      "open &lt;x&gt;    open github | linkedin | 20bucks | list | markets | oracular",
      "tulip       a cautionary tale",
      "clear       clear the screen",
      "exit        close (or press esc)",
    ].join("\n"),
    now: () => `National Service as a transport operator until Feb 2027.\nOn the side: finance and content at ${a("https://www.advisory.sg", "Advisory Singapore")}, and whatever I'm fixing in 20bucks this week.\nThen Economics, from Oct 2027.`,
    ns: () => "still serving as a transport operator. back in Feb 2027.",
    makan: () => `hungry? ${a(LINKS.list, "list.ethantam.dev")} has opinions.`,
    hire: () => COMMANDS.contact(),
    about: () => "Ethan Tam, Singapore.\nDoing National Service now, Economics at Cambridge from 2027.\nI like markets, economics, and building small apps for myself and my friends.",
    projects: () => [
      `20bucks     personal finance PWA: splits, PayLater, P&L, AI review   ${a(LINKS["20bucks"], "app")} ${a("https://github.com/Ethosan/moneytracker", "src")}`,
      `The List    ratings, leaderboard, auto want list, Telegram bot       ${a(LINKS.list, "app")} ${a("https://github.com/Ethosan/Makan-bot", "src")}`,
      `Markets     macro dashboard: risk, regime, absorption, recession     ${a(LINKS.markets, "app")} ${a("https://github.com/Ethosan/eqmarkets", "src")}`,
      `Oracular    research terminal: memo, scorecard, seasonality, chat     ${a(LINKS.oracular, "app")} ${a("https://github.com/Ethosan/oracular", "src")}`,
    ].join("\n"),
    record: () => [
      "2027     Economics (BA), University of Cambridge",
      "2026–    Finance & Content, Advisory Singapore",
      "2025–27  National Service · Transport Operator, Singapore Armed Forces",
      "2023–24  Co-founder, ACSians Investment Club",
      "2023–24  Co-founder, Project Lumos",
    ].join("\n"),
    contact: () => `email     ${a("mailto:eatentam@gmail.com", "eatentam@gmail.com")}\ngithub    ${a(LINKS.github, "Ethosan")}\nlinkedin  ${a(LINKS.linkedin, "ethantam-")}`,
    open: (arg) => {
      const url = LINKS[arg];
      if (!url) return `open: unknown target "${esc(arg || "")}". try: ${Object.keys(LINKS).join(", ")}`;
      window.open(url, "_blank", "noopener");
      return `opening ${arg}…`;
    },
    watchlist: () => quotes.map((q) => {
      const px = typeof q.p === "number" ? fmtPx(q.p) : "—";
      const chg = typeof q.c === "number" ? `<span class="${q.c >= 0 ? "up" : "dn"}">${q.c >= 0 ? "+" : ""}${q.c.toFixed(2)}%</span>` : "";
      return `${q.s.padEnd(6)}${px.padStart(10)}   ${chg}`;
    }).join("\n") + "\n\nnot financial advice. see also: tulip",
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

  form.addEventListener("submit", (e) => { e.preventDefault(); run(input.value); input.value = ""; });
  input.addEventListener("keydown", (e) => {
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
})();
