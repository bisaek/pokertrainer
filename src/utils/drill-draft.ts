// The drill editor's working copy of an exercise, and how it turns into the
// exercise a drill keeps. Shared by the drill editor and a course's lessons,
// which can hold drills of their own.
import { resolveUrls, type ChartPick, type ExerciseTemplate, type RangeFilter } from "./drills";
import type { RangeInfo } from "./manifest";
import { exerciseGroups, type ExerciseSettings, type MistakeMode, type SettingKey } from "./settings.svelte";

// A set of charts: an empty list means every one.
export type PickDraft = { positions: string[]; types: string[]; opponents: string[] };

// Each exercise takes the charts of one or more picks, so opens from every
// seat and the big blind's defense can go in the same exercise.
export type ExerciseDraft = {
  kind: "range" | "hands";
  picks: PickDraft[];
  timesInARow: number;
  count: number;
  mistakes: MistakeMode;
  repeatMistakes: boolean;
  // What the exercise says about the display options; an option not in
  // here is the player's to set.
  settings: ExerciseSettings;
};

export function blankPick(): PickDraft {
  return { positions: [], types: [], opponents: [] };
}

export function blankExercise(kind: "range" | "hands"): ExerciseDraft {
  return {
    kind,
    picks: [blankPick()],
    timesInARow: 1,
    count: 30,
    mistakes: "retry",
    repeatMistakes: true,
    settings: {},
  };
}

export function draftOf(exercise: ExerciseTemplate): ExerciseDraft {
  const filters = Array.isArray(exercise.filter) ? exercise.filter : [exercise.filter];
  return {
    kind: exercise.kind,
    picks: filters.map((filter) => ({
      positions: filter.positions ?? [],
      types: filter.types,
      opponents: filter.opponents ?? [],
    })),
    timesInARow: exercise.kind === "range" ? exercise.timesInARow : 1,
    count: exercise.kind === "hands" ? exercise.count : 30,
    mistakes: (exercise.kind === "hands" && exercise.mistakes) || "retry",
    repeatMistakes: exercise.kind === "hands" ? (exercise.repeatMistakes ?? true) : true,
    settings: structuredClone(exercise.settings ?? {}),
  };
}

export function copyPicks(picks: PickDraft[]): PickDraft[] {
  return picks.map((pick) => ({
    positions: [...pick.positions],
    types: [...pick.types],
    opponents: [...pick.opponents],
  }));
}

export function filterOfPick(pick: PickDraft): RangeFilter {
  return {
    types: pick.types,
    positions: pick.positions.length ? pick.positions : undefined,
    opponents: pick.opponents.length ? pick.opponents : undefined,
  };
}

export function filterOf(exercise: ExerciseDraft): ChartPick {
  const filters = exercise.picks.map(filterOfPick);
  return filters.length === 1 ? filters[0] : filters;
}

// Only the options the exercise's kind shows are kept, so switching kinds
// doesn't save rules for options the player never saw.
export function settingsOf(exercise: ExerciseDraft): ExerciseSettings | undefined {
  const keys = exerciseGroups(exercise.kind).flatMap((group) =>
    group.toggles.map((toggle) => toggle.key)
  );
  const kept = Object.fromEntries(
    Object.entries(exercise.settings).filter(([key]) => keys.includes(key as SettingKey))
  ) as ExerciseSettings;
  return Object.keys(kept).length > 0 ? kept : undefined;
}

export function clampCount(count: number) {
  return Math.min(200, Math.max(1, Math.round(count) || 1));
}

export function templateOf(exercise: ExerciseDraft): ExerciseTemplate {
  const filter = filterOf(exercise);
  const settings = settingsOf(exercise);
  return exercise.kind === "range"
    ? { kind: "range", filter, timesInARow: exercise.timesInARow, settings }
    : {
        kind: "hands",
        filter,
        count: clampCount(exercise.count),
        mistakes: exercise.mistakes,
        repeatMistakes: exercise.repeatMistakes,
        settings,
      };
}

export function chartCount(
  exercise: ExerciseDraft,
  manifest: RangeInfo[],
  game: string,
  stack: number
): number {
  return resolveUrls(filterOf(exercise), manifest, game, stack).length;
}

// Why the exercises can't be saved yet; empty when they can.
export function exerciseErrors(
  exercises: ExerciseDraft[],
  manifest: RangeInfo[],
  game: string,
  stack: number
): string[] {
  const list: string[] = [];
  if (exercises.length === 0) list.push("Add at least one exercise.");
  exercises.forEach((exercise, index) => {
    if (chartCount(exercise, manifest, game, stack) === 0) {
      list.push(`Exercise ${index + 1} has no charts.`);
    }
  });
  return list;
}
