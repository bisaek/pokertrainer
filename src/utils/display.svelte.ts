// What the hand trainer draws around the question. Kept in this browser, so
// the choice holds across pages and visits.
const STORAGE_KEY = "pokertrainer.display";

export const display = $state({
  // The poker table above the action bar.
  board: true,
  // The name of the chart the hand is from; without it the spot has to be
  // read off the board.
  chartName: true,
  // The hand written out ("AKs") next to the cards.
  handName: true,
  // How many hands are left to answer.
  handsLeft: true,
  // The key badges on the action buttons; the keys work either way.
  keyHints: true,
  // The greyed-out chart that holds the chart's place while there is no
  // mistake to review.
  idleChart: true,
  // The chart with the mistake marked on it after a wrong answer.
  mistakeChart: true,
});

export type DisplayOption = keyof typeof display;

export function loadDisplay() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    for (const key of Object.keys(display) as DisplayOption[]) {
      if (typeof saved[key] === "boolean") display[key] = saved[key];
    }
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
