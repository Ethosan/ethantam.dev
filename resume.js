// The resume page: the Print button (hidden without JavaScript), a file name for "Save as PDF", and the theme toggle.
const printBtn = document.querySelector("[data-print]");
printBtn.hidden = false;
// the in-app browsers of LinkedIn and Instagram ignore print(): if no print dialog starts, open the PDF instead
let printing = false;
addEventListener("beforeprint", () => { printing = true; });
printBtn.addEventListener("click", () => {
  printing = false;
  window.print();
  setTimeout(() => { if (!printing) location.href = "/ethan-tam-cv.pdf"; }, 800);
});

// any CSS colour (the tokens are oklch) as [r, g, b, a], read back from a 1px canvas
const cssRgb = (color) => {
  const px = Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
  px.fillStyle = color; px.fillRect(0, 0, 1, 1);
  return px.getImageData(0, 0, 1, 1).data;
};
const cssHex = (color) => "#" + [...cssRgb(color)].slice(0, 3).map((n) => n.toString(16).padStart(2, "0")).join("");

// an opt-in reading view: the same CV as a plain column at a normal text size, instead of the scaled A4 page
// (print and the PDF stay the A4 sheet)
const reflowBtn = document.querySelector("[data-reflow]");
if (reflowBtn) {
  reflowBtn.hidden = false;
  reflowBtn.addEventListener("click", () => {
    const on = document.querySelector(".resume").classList.toggle("is-reflow");
    reflowBtn.setAttribute("aria-pressed", String(on));
    reflowBtn.textContent = on ? "Show the A4 page" : "Reflow to read";
  });
}

const pageTitle = document.title;
addEventListener("beforeprint", () => { document.title = "Ethan Tam CV"; });
addEventListener("afterprint", () => { document.title = pageTitle; });

// the same toggle and dawn/dusk wipe as the home page (main.js); the sheet stays paper either way
const root = document.documentElement;
const themeBtn = document.querySelector("[data-toggle-theme]");
const isLight = () => root.dataset.theme === "light" ||
  (!root.dataset.theme && matchMedia("(prefers-color-scheme: light)").matches);
// the phone's status bar takes its colour from theme-color, which only knows the system setting; follow the toggle
const themeColors = document.querySelectorAll('meta[name="theme-color"]');
const updateThemeBtn = () => {
  themeBtn.setAttribute("aria-pressed", String(isLight()));
  const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
  if (bg) themeColors.forEach((m) => m.setAttribute("content", cssHex(bg)));
};
themeBtn.addEventListener("click", () => {
  const next = isLight() ? "dark" : "light";
  const apply = () => {
    root.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch {}
    updateThemeBtn();
  };
  if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) { apply(); return; }
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
    root.animate(
      { clipPath: [toLight ? "inset(100% 0 0 0)" : "inset(0 0 100% 0)", "inset(0 0 0 0)"] },
      { duration: 480, easing: "cubic-bezier(.16, 1, .3, 1)", pseudoElement: "::view-transition-new(root)" }
    );
  }).finally(() => {
    root.classList.remove("theme-wipe");
    band.remove();
  });
});
updateThemeBtn();
matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => { if (!root.dataset.theme) updateThemeBtn(); });
