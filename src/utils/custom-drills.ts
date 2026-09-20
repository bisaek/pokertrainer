import type { ExerciseTemplate } from "./drills";
import { settings } from "./settings.svelte";

// A drill the player put together on /drills/new. It is made for one game and
// stack, and kept in this browser.
export type CustomDrill = {
  id: string;
  name: string;
  description: string;
  game: string;
  stack: number;
  exercises: ExerciseTemplate[];
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
function isCustomDrill(value: unknown): value is CustomDrill {
  if (typeof value !== "object" || value === null) return false;
  const drill = value as Record<string, unknown>;
  return (
    typeof drill.id === "string" &&
    typeof drill.name === "string" &&
    typeof drill.description === "string" &&
    typeof drill.game === "string" &&
    typeof drill.stack === "number" &&
    Array.isArray(drill.exercises) &&
    drill.exercises.every(isExercise)
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

function isFilter(value: unknown): boolean {
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
