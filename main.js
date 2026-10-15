(() => {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, el = document) => el.querySelector(s);

  /* ---------- clock + year ---------- */
  const clock = $("#clock");
  const sgt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Singapore", hour: "2-digit", minute: "2-digit" });
  const tickClock = () => { clock.textContent = sgt.format(new Date()); };
  tickClock();
  setInterval(tickClock, 15_000);
  $("#year").textContent = new Date().getFullYear();

  /* ---------- ticker ---------- */
  const STATIC = [
    ["IB", "44/45"],
    ["UKMT", "GOLD ×3"],
    ["CS50", "COMPLETE"],
    ["SHIPPED", "2 APPS"],
    ["TULIP", "1637", -99.0],
  ];
  const COINS = { bitcoin: "BTC", ethereum: "ETH", solana: "SOL" };
  let quotes = [];

  const fmtUsd = (n) => n >= 1000 ? n.toLocaleString("en-US", { maximumFractionDigits: 0 }) : n.toFixed(2);
  const item = ([sym, val, chg]) => {
    const change = typeof chg === "number"
      ? ` <i class="${chg >= 0 ? "up" : "dn"}">${chg >= 0 ? "▲" : "▼"} ${Math.abs(chg).toFixed(1)}%</i>`
      : "";
    return `<span class="tk"><b>${sym}</b>${val}${change}</span>`;
  };
  const renderTicker = () => {
    const html = [...quotes, ...STATIC].map(item).join("");
    // doubled so the CSS loop can translate -50% seamlessly
    $("#ticker").innerHTML = html + html;
  };
  const loadQuotes = async () => {
    try {
      const ids = Object.keys(COINS).join(",");
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`);
      if (!r.ok) throw new Error(r.status);
      const data = await r.json();
      quotes = Object.entries(COINS)
        .filter(([id]) => data[id])
        .map(([id, sym]) => [sym, fmtUsd(data[id].usd), data[id].usd_24h_change]);
    } catch { /* keep whatever we had; static items still show */ }
    renderTicker();
  };
  renderTicker();
  loadQuotes();
  setInterval(loadQuotes, 90_000);

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
  if (img.complete && img.naturalWidth) dither();
  else { img.addEventListener("load", dither); img.addEventListener("error", () => art.classList.add("no-dither")); }

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
    "20bucks": "https://github.com/Ethosan/moneytracker",
    list: "https://github.com/Ethosan/Makan-bot",
  };
  const a = (href, text = href) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

  const COMMANDS = {
    help: () => [
      "help        this list",
      "about       who I am",
      "projects    what I've built",
      "record      the short CV",
      "contact     how to reach me",
      "open &lt;x&gt;    open github | linkedin | 20bucks | list",
      "tulip       a cautionary tale",
      "clear       clear the screen",
      "exit        close (or press esc)",
    ].join("\n"),
    about: () => "Ethan Tam. Singapore.\nI build web apps and bots that fix problems in my own life, then polish them\nuntil other people can use them. Economics and finance by training, code by habit.",
    projects: () => [
      `20bucks     personal finance PWA: splits, PayLater, P&L, AI review   ${a(LINKS["20bucks"], "src")}`,
      `The List    restaurant ratings + auto-researched want list + bot     ${a(LINKS.list, "src")}`,
    ].join("\n"),
    record: () => [
      "2023–24  Founder & President, ACSians Investment Society",
      "2023–24  Intern, Cyanstone Ltd",
      "2024     IB Diploma 44/45, ACS (Independent)",
      "2021–22  UKMT Gold ×3",
      "2021     Intern, Axis Law Corporation",
    ].join("\n"),
    contact: () => `email     ${a("mailto:eatentam@gmail.com", "eatentam@gmail.com")}\ngithub    ${a(LINKS.github, "Ethosan")}\nlinkedin  ${a(LINKS.linkedin, "ethantam-")}`,
    open: (arg) => {
      const url = LINKS[arg];
      if (!url) return `open: unknown target "${arg || ""}". try: ${Object.keys(LINKS).join(", ")}`;
      window.open(url, "_blank", "noopener");
      return `opening ${arg}…`;
    },
    tulip: () => "Feb 1637: a single Semper Augustus bulb was quoted at more than a house on an\nAmsterdam canal. A few weeks later, buyers stopped showing up.\nThe painting on the front page is from about 20 years before the peak.",
    ls: () => "about  projects  record  contact  tulip",
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
    const res = fn ? fn(args.join(" ").toLowerCase()) : `command not found: ${name.replace(/[<>&]/g, "")}. type \`help\``;
    if (name.toLowerCase() !== "clear") print(line, res);
  };

  const openTerm = () => {
    if (!term.hidden) return;
    opener = document.activeElement;
    term.hidden = false;
    document.body.style.overflow = "hidden";
    if (!out.childElementCount) print("help", COMMANDS.help());
    input.focus();
  };
  const closeTerm = () => {
    term.hidden = true;
    document.body.style.overflow = "";
    opener?.focus?.();
  };

  form.addEventListener("submit", (e) => { e.preventDefault(); run(input.value); input.value = ""; });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" && hIdx > 0) { input.value = history[--hIdx]; e.preventDefault(); }
    if (e.key === "Tab") {
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
