import type { DrillItem, ExerciseTemplate } from "./drills";
import { settings } from "./settings.svelte";

// A drill the player put together on /drills/new. It is made for one game and
// stack, and kept in this browser.
export type CustomDrill = {
  id: string;
  name: string;
  description: string;
  game: string;
  stack: number;
  exercises: DrillItem[];
};

const STORAGE_KEY = "pokertrainer.custom-drills.v1";

export function loadCustomDrills(): CustomDrill[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(saved) ? saved.filter(isCustomDrill) : [];
  } catch {
    // Nothing saved, or storage is blocked.
    return [];
  }
}

// Adds the drill, or replaces the saved one with the same id.
export function saveCustomDrill(drill: CustomDrill): CustomDrill[] {
  const drills = loadCustomDrills();
  const index = drills.findIndex((item) => item.id === drill.id);
  if (index === -1) drills.push(drill);
  else drills[index] = drill;
  store(drills);
  return drills;
}

export function removeCustomDrill(id: string): CustomDrill[] {
  const drills = loadCustomDrills().filter((item) => item.id !== id);
  store(drills);
  return drills;
}

// A drill file: one or more drills, marked so a stray JSON file is told apart.
const FILE_KIND = "pokertrainer-drills";
const FILE_VERSION = 1;

type DrillFile = { kind: typeof FILE_KIND; version: number; drills: CustomDrill[] };

export function serializeDrills(drills: CustomDrill[]): string {
  const file: DrillFile = { kind: FILE_KIND, version: FILE_VERSION, drills };
  return JSON.stringify(file, null, 2);
}

// Reads a drill file back. A bare drill, or a bare list of them, is taken too.
// Throws with a message fit to show when the file isn't drills at all.
export function parseDrillFile(text: string): CustomDrill[] {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("This isn't a JSON file.");
  }
  const list = Array.isArray(json)
    ? json
    : typeof json === "object" && json !== null && "drills" in json
      ? (json as { drills: unknown }).drills
      : [json];
  if (!Array.isArray(list) || list.length === 0 || !list.every(isCustomDrill)) {
    throw new Error("This file doesn't hold drills from this site.");
  }
  return list;
}

// Puts the drills from a file in with the saved ones. A drill already saved
// with the same id is replaced, so a drill downloaded and uploaded again
// doesn't double up.
export function importCustomDrills(imported: CustomDrill[]): {
  drills: CustomDrill[];
  added: number;
  replaced: number;
} {
  const drills = loadCustomDrills();
  let added = 0;
  let replaced = 0;
  for (const drill of imported) {
    const index = drills.findIndex((item) => item.id === drill.id);
    if (index === -1) {
      drills.push(drill);
      added++;
    } else {
      drills[index] = drill;
      replaced++;
    }
  }
  store(drills);
  return { drills, added, replaced };
}

// Saves the drills as a file through the browser's download.
export function downloadDrills(drills: CustomDrill[], name: string) {
  const blob = new Blob([serializeDrills(drills)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "drills"}.json`;
  document.body.appendChild(anchor); // Firefox wants it in the page.
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function newDrillId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function store(drills: CustomDrill[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drills));
  } catch {
    // Storage is full or blocked; the drill lasts until the page is closed.
  }
}

// Whatever is in storage came from an older version or a hand edit, so a
// drill that doesn't have the right shape is left out rather than crashing.
export function isCustomDrill(value: unknown): value is CustomDrill {
  if (typeof value !== "object" || value === null) return false;
  const drill = value as Record<string, unknown>;
  return (
    typeof drill.id === "string" &&
    typeof drill.name === "string" &&
    typeof drill.description === "string" &&
    typeof drill.game === "string" &&
    typeof drill.stack === "number" &&
    Array.isArray(drill.exercises) &&
    drill.exercises.every(isItem)
  );
}

function isItem(value: unknown): value is DrillItem {
  if (typeof value !== "object" || value === null) return false;
  const group = value as Record<string, unknown>;
  if (group.kind !== "group") return isExercise(value);
  const optional = (key: string, type: string) =>
    group[key] === undefined || typeof group[key] === type;
  return (
    Array.isArray(group.items) &&
    group.items.every(isItem) &&
    optional("name", "string") &&
    optional("shuffle", "boolean") &&
    optional("redoMistakes", "boolean") &&
    optional("redoParts", "boolean") &&
    optional("pick", "number") &&
    optional("repeat", "number")
  );
}

function isExercise(value: unknown): value is ExerciseTemplate {
  if (typeof value !== "object" || value === null) return false;
  const exercise = value as Record<string, unknown>;
  const picks = Array.isArray(exercise.filter) ? exercise.filter : [exercise.filter];
  if (picks.length === 0 || !picks.every(isFilter)) return false;
  if (exercise.settings !== undefined && !isExerciseSettings(exercise.settings)) return false;
  if (exercise.kind === "range") return typeof exercise.timesInARow === "number";
  return (
    exercise.kind === "hands" &&
    typeof exercise.count === "number" &&
    (exercise.mistakes === undefined ||
      exercise.mistakes === "retry" ||
      exercise.mistakes === "move-on") &&
    (exercise.repeatMistakes === undefined || typeof exercise.repeatMistakes === "boolean")
  );
}

// Each entry names a setting and gives it a value of that setting's type.
function isExerciseSettings(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  return Object.entries(value as Record<string, unknown>).every(([key, rule]) => {
    if (!(key in settings) || typeof rule !== "object" || rule === null) return false;
    const { value: setTo, locked } = rule as Record<string, unknown>;
    return (
      typeof setTo === typeof settings[key as keyof typeof settings] && typeof locked === "boolean"
    );
  });
}

export function isFilter(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const filter = value as Record<string, unknown>;
  const isList = (list: unknown) =>
    list === undefined ||
    (Array.isArray(list) && list.every((item) => typeof item === "string"));
  return (
    Array.isArray(filter.types) &&
    isList(filter.types) &&
    isList(filter.positions) &&
    isList(filter.opponents)
  );
}
