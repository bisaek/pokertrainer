// What the table shows, as a per-browser preference: some people want the
// full picture, others find the folded seats or the table itself distracting.

const STORAGE_KEY = "pokertrainer.display";

export type DisplayOption = "table" | "foldedSeats" | "bets";

export const displayLabels: Record<DisplayOption, string> = {
  table: "Table",
  foldedSeats: "Folded players",
  bets: "Bets",
};

const defaults: Record<DisplayOption, boolean> = {
  table: true,
  foldedSeats: true,
  bets: true,
};

// Shared by every table on the page, so a toggle moves all of them at once.
export const display: Record<DisplayOption, boolean> = $state({ ...defaults });

function keys(): DisplayOption[] {
  return Object.keys(defaults) as DisplayOption[];
}

// Reads the stored preferences once, on the client. Unknown or missing keys
// keep their default, so adding an option later doesn't break a saved value.
export function loadDisplay() {
  if (typeof localStorage === "undefined") return;
  let stored: unknown;
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return;
  }
  if (!stored || typeof stored !== "object") return;
  for (const key of keys()) {
    const value = (stored as Record<string, unknown>)[key];
    if (typeof value === "boolean") display[key] = value;
  }
}

export function toggleDisplay(option: DisplayOption) {
  display[option] = !display[option];
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...display }));
  } catch {
    // A full or blocked storage shouldn't stop the toggle from working.
  }
}
