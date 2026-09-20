import type { ExerciseTemplate } from "./drills";

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
  const filter = exercise.filter as Record<string, unknown> | undefined;
  const isList = (list: unknown) =>
    list === undefined ||
    (Array.isArray(list) && list.every((item) => typeof item === "string"));
  if (
    typeof filter !== "object" ||
    filter === null ||
    !Array.isArray(filter.types) ||
    !isList(filter.types) ||
    !isList(filter.positions) ||
    !isList(filter.opponents)
  ) {
    return false;
  }
  return (
    (exercise.kind === "range" && typeof exercise.timesInARow === "number") ||
    (exercise.kind === "hands" && typeof exercise.count === "number")
  );
}
