// The resume page: the Print button (hidden without JavaScript), a file name for "Save as PDF", and the theme toggle.
const printBtn = document.querySelector("[data-print]");
printBtn.hidden = false;
printBtn.addEventListener("click", () => window.print());

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
  if (bg) themeColors.forEach((m) => m.setAttribute("content", bg));
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
