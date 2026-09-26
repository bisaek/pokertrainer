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
  // round favors hands at the edge of a region, where mistakes happen.
  handCount: 0,

  // Range trainer.
  // A chart rebuilt wrong is asked again right away.
  rangeRetry: true,
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
  // Random player names in the seats instead of their positions, so the
  // positions have to be read off the dealer button.
  playerNames: false,
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
  // Outline the hand being asked about on the answer or the waiting chart.
  markHand: false,
  // The grayed-out chart in the hand trainer while there is no mistake to
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

// The display toggles, grouped as the Options menu and the drill editor show them.
export type Toggle = { key: SettingKey; label: string; hint?: string; needs?: SettingKey };
export type ToggleGroup = { label: string; toggles: Toggle[] };

export const tableGroup: ToggleGroup = {
  label: "Table",
  toggles: [
    { key: "board", label: "Board" },
    { key: "foldedSeats", label: "Folded players", needs: "board" },
    { key: "bets", label: "Blinds and bets", needs: "board" },
    { key: "playerNames", label: "Names instead of positions", needs: "board" },
  ],
};
export const aroundHandGroup: ToggleGroup = {
  label: "Around the hand",
  toggles: [
    { key: "chartName", label: "Chart name" },
    { key: "handName", label: "Hand name" },
    { key: "progress", label: "Hands left" },
    { key: "keyHints", label: "Key hints" },
  ],
};
export const aroundChartGroup: ToggleGroup = {
  label: "Around the chart",
  toggles: [
    { key: "chartName", label: "Chart name", hint: "Shown after a check" },
    { key: "progress", label: "Charts left" },
    { key: "keyHints", label: "Key hints" },
  ],
};
export const chartGroup: ToggleGroup = {
  label: "Chart",
  toggles: [
    { key: "answerChart", label: "The answer" },
    { key: "idleChart", label: "While waiting" },
    { key: "idleKinds", label: "Color pairs, suited and offsuit", needs: "idleChart" },
    { key: "markHand", label: "Mark the hand" },
    { key: "mistakeChart", label: "After a mistake" },
  ],
};
export const pageGroup: ToggleGroup = {
  label: "Page",
  toggles: [{ key: "picker", label: "Chart picker" }],
};

// The display groups a drill exercise of this kind draws on.
export function exerciseGroups(kind: "range" | "hands"): ToggleGroup[] {
  return kind === "range" ? [tableGroup, aroundChartGroup] : [tableGroup, aroundHandGroup, chartGroup];
}

// What a drill exercise says about the options: a value for each it sets,
// and whether the player may change it while the exercise runs.
export type ExerciseSettings = {
  [K in SettingKey]?: { value: Settings[K]; locked: boolean };
};

// The options the running exercise has fixed; the Options menu greys them out.
export const drillLocks: { keys: SettingKey[] } = $state({ keys: [] });

// The player's own choices, kept aside while an exercise sets its own, and
// the keys it set. Changes the player makes to those keys during the exercise
// last only for the exercise.
let stashed: Settings | null = null;
let presetKeys: SettingKey[] = [];

// Starts an exercise's rules: the player's choices come back first, so one
// exercise's settings don't leak into the next.
export function applyExerciseSettings(rules: ExerciseSettings) {
  loadSettings();
  if (stashed === null) stashed = $state.snapshot(settings);
  Object.assign(settings, stashed);
  presetKeys = [];
  drillLocks.keys = [];
  for (const key of Object.keys(rules) as SettingKey[]) {
    const rule = rules[key];
    if (!rule || !isValid(key, rule.value)) continue;
    (settings as Record<SettingKey, unknown>)[key] = rule.value;
    presetKeys.push(key);
    if (rule.locked) drillLocks.keys.push(key);
  }
}

// Ends the exercise's rules and puts the player's choices back.
export function clearExerciseSettings() {
  if (stashed !== null) Object.assign(settings, stashed);
  stashed = null;
  presetKeys = [];
  drillLocks.keys = [];
}

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

// Writes the player's own choices: what an exercise set for them isn't theirs.
export function saveSettings() {
  const own = $state.snapshot(settings);
  if (stashed !== null) {
    for (const key of presetKeys) (own as Record<SettingKey, unknown>)[key] = stashed[key];
    stashed = own;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(own));
  } catch {
    // Storage is full or blocked; the choice lasts until the page is closed.
  }
}

export function resetSettings() {
  const rules = stashed !== null ? currentRules() : null;
  Object.assign(settings, defaults);
  if (rules) {
    stashed = $state.snapshot(settings);
    applyExerciseSettings(rules);
  }
  saveSettings();
}

// The running exercise's rules, read back so they can be put on again.
function currentRules(): ExerciseSettings {
  const rules: Record<string, unknown> = {};
  for (const key of presetKeys) {
    rules[key] = { value: settings[key], locked: drillLocks.keys.includes(key) };
  }
  return rules as ExerciseSettings;
}

const defaults = $state.snapshot(settings);
