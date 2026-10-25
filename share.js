// The QR code full screen, for someone to scan straight off your phone. Any [data-show-qr] button opens it, and so
// does arriving at /#qr (the installed app's "Show my QR code" shortcut). Black on white whatever the theme, so it
// scans; the screen stays awake while it's up. Esc, Close or the phone's back gesture put it away.
(() => {
  let dialog = null, lock = null, pushed = false;

  const build = () => {
    const d = document.createElement("dialog");
    d.className = "qr";
    d.setAttribute("aria-labelledby", "qr-name");
    d.tabIndex = -1; // focusable, so opening can focus the screen itself rather than put a focus ring on Close
    d.innerHTML = `
      <p class="qr__name" id="qr-name">Ethan Tam</p>
      <img class="qr__code" src="/assets/qr.svg?v=2" alt="QR code that opens ethantam.dev" width="290" height="290">
      <p class="qr__url mono">ethantam.dev</p>
      <p class="qr__note">Scan with a phone camera for my CV, projects and how to reach me.</p>
      <button type="button" class="qr__done mono">Close</button>`;
    d.querySelector(".qr__done").addEventListener("click", () => d.close());
    d.addEventListener("close", () => {
      lock?.release().catch(() => {});
      lock = null;
      // take back the #qr entry this opened, so Back afterwards leaves the page as usual
      if (pushed) { pushed = false; history.back(); }
      else if (location.hash === "#qr") history.replaceState(null, "", location.pathname + location.search);
    });
    document.body.append(d);
    return d;
  };

  const keepAwake = () => {
    if (dialog?.open && !lock && document.visibilityState === "visible") {
      navigator.wakeLock?.request("screen").then((l) => { lock = l; l.addEventListener("release", () => { lock = null; }); }, () => {});
    }
  };

  const open = (fromHash = false) => {
    dialog ??= build();
    if (dialog.open) return;
    dialog.showModal();
    dialog.focus();
    // its own history entry, so the back gesture closes it instead of leaving the site
    if (!fromHash) { history.pushState(null, "", "#qr"); pushed = true; }
    keepAwake();
  };

  document.addEventListener("click", (e) => { if (e.target.closest("[data-show-qr]")) open(); });
  addEventListener("popstate", () => { if (dialog?.open && location.hash !== "#qr") { pushed = false; dialog.close(); } });
  addEventListener("hashchange", () => { if (location.hash === "#qr") open(true); }); // a link to #qr, or typing it
  document.addEventListener("visibilitychange", keepAwake); // the lock goes when the tab hides; take it back
  if (location.hash === "#qr") open(true);
})();
