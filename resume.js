// The resume page: the Print button (hidden without JavaScript), and a file name for "Save as PDF".
const printBtn = document.querySelector("[data-print]");
printBtn.hidden = false;
printBtn.addEventListener("click", () => window.print());

const pageTitle = document.title;
addEventListener("beforeprint", () => { document.title = "Ethan Tam CV"; });
addEventListener("afterprint", () => { document.title = pageTitle; });
