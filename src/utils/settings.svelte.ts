// How the trainers work and what they show. Kept in this browser, so the
// choice holds across pages and visits.
const STORAGE_KEY = "pokertrainer.settings";

// What to do with a hand answered wrong: keep asking it until it is right, or
// move on to the next hand.
export type MistakeMode = "retry" | "move-on";

export const settings = $state({
  // Hand trainer.
  // What happens right after a wrong answer.
  handMistakes: "retry" as MistakeMode,
  // A hand answered wrong is asked again at the end of the round.
  handRepeat: true,
  // How many hands a round asks; 0 asks every hand in the charts. A shorter
  // round favours hands at the edge of a region, where mistakes happen.
  handCount: 0,

  // Range trainer.
  // A chart rebuilt wrong is asked again at the end of the round.
  rangeRepeat: true,
  // How many times in a row a chart has to be rebuilt right before it is done.
  rangeStreak: 1,
  // After a check, outline every cell with the chart's action.
  rangeAnswer: true,

  // What is drawn around the question.
  // The chart picker at the top of the hand and range trainers. Hidden, it
  // leaves more room for the training and keeps the chart's spot a secret.
  picker: true,
  // The poker table.
  board: true,
  // The seats that folded before the hero acts, and their dealer button.
  foldedSeats: true,
  // The blinds and bets on the table.
  bets: true,
  // The name of the chart being trained; without it the spot has to be read
  // off the board. The range trainer still reveals it after a check.
  chartName: true,
  // The hand written out ("AKs") next to the cards.
  handName: true,
  // How many hands or charts are left in the round.
  progress: true,
  // The key badges on the action buttons; the keys work either way.
  keyHints: true,
  // The chart the hand is from, with the hand marked, beside the question in
  // the hand trainer: for learning a chart rather than testing it.
  answerChart: false,
  // Outline the hand being asked about on the answer chart.
  markHand: false,
  // The greyed-out chart in the hand trainer while there is no mistake to
  // review. Its place is kept either way, so the board doesn't jump.
  idleChart: true,
  // Tint the waiting chart's cells by kind: pairs, suited and offsuit hands.
  idleKinds: false,
  // The chart with the mistake marked on it after a wrong answer.
  mistakeChart: true,
});

export type Settings = typeof settings;
export type SettingKey = keyof Settings;

export const handCounts = [0, 20, 50, 100];
export const rangeStreaks = [1, 2, 3];

let loaded = false;

// Reads the saved choices. Called once the page is on screen: reading them
// while the server-rendered page is being hydrated would change its shape.
export function loadSettings() {
  if (loaded) return;
  loaded = true;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    for (const key of Object.keys(settings) as SettingKey[]) {
      const value = saved[key];
      if (value !== undefined && isValid(key, value)) {
        (settings as Record<SettingKey, unknown>)[key] = value;
      }
    }
  } catch {
    // Nothing saved, or storage is blocked: keep the defaults.
  }
}

function isValid(key: SettingKey, value: unknown): boolean {
  switch (key) {
    case "handMistakes":
      return value === "retry" || value === "move-on";
    case "handCount":
      return handCounts.includes(value as number);
    case "rangeStreak":
      return rangeStreaks.includes(value as number);
    default:
      return typeof value === typeof settings[key];
  }
}

export function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify($state.snapshot(settings)));
  } catch {
    // Storage is full or blocked; the choice lasts until the page is closed.
  }
}

export function resetSettings() {
  Object.assign(settings, defaults);
  saveSettings();
}

const defaults = $state.snapshot(settings);
