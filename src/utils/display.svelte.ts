// What the hand trainer draws around the question. Kept in this browser, so
// the choice holds across pages and visits.
const STORAGE_KEY = "pokertrainer.display";

export const display = $state({
  // The poker table above the action bar.
  board: true,
  // The greyed-out chart that holds the chart's place while there is no
  // mistake to review.
  idleChart: true,
});

export function loadDisplay() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (typeof saved.board === "boolean") display.board = saved.board;
    if (typeof saved.idleChart === "boolean") display.idleChart = saved.idleChart;
  } catch {
    // Nothing saved, or storage is blocked: keep the defaults.
  }
}

export function saveDisplay() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify($state.snapshot(display)));
  } catch {
    // Storage is full or blocked; the choice lasts until the page is closed.
  }
}
