// The drill editor's working copy of an exercise, and how it turns into the
// exercise a drill keeps. Shared by the drill editor and a course's lessons,
// which can hold drills of their own.
import {
  resolveUrls,
  type ChartPick,
  type DrillItem,
  type ExerciseTemplate,
  type RangeFilter,
} from "./drills";
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

// A group of exercises and the rules it plays them by (see GroupRules).
export type GroupDraft = {
  kind: "group";
  name: string;
  items: ItemDraft[];
  shuffle: boolean;
  redoMistakes: boolean;
  redoParts: boolean;
  // How many of its parts to play; null plays them all.
  pick: number | null;
  repeat: number;
};

export type ItemDraft = ExerciseDraft | GroupDraft;

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

export function blankGroup(items: ItemDraft[] = []): GroupDraft {
  return {
    kind: "group",
    name: "",
    items,
    shuffle: false,
    redoMistakes: false,
    redoParts: false,
    pick: null,
    repeat: 1,
  };
}

export function draftOf(item: DrillItem): ItemDraft {
  if (item.kind !== "group") return exerciseDraftOf(item);
  return {
    kind: "group",
    name: item.name ?? "",
    items: item.items.map(draftOf),
    shuffle: item.shuffle ?? false,
    redoMistakes: item.redoMistakes ?? false,
    redoParts: item.redoParts ?? false,
    pick: item.pick ?? null,
    repeat: item.repeat ?? 1,
  };
}

function exerciseDraftOf(exercise: ExerciseTemplate): ExerciseDraft {
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

// Only the rules that differ from the defaults are kept.
export function templateOf(item: ItemDraft): DrillItem {
  if (item.kind !== "group") return exerciseTemplateOf(item);
  return {
    kind: "group",
    name: item.name.trim() || undefined,
    items: item.items.map(templateOf),
    shuffle: item.shuffle || undefined,
    redoMistakes: item.redoMistakes || undefined,
    redoParts: item.redoParts || undefined,
    pick: item.pick ?? undefined,
    repeat: item.repeat > 1 ? item.repeat : undefined,
  };
}

function exerciseTemplateOf(exercise: ExerciseDraft): ExerciseTemplate {
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

// Every exercise, groups opened up, in the order they are written.
export function exercisesIn(items: ItemDraft[]): ExerciseDraft[] {
  return items.flatMap((item) => (item.kind === "group" ? exercisesIn(item.items) : [item]));
}

// Puts each exercise that answers hands from a chart the exercise before it
// used in a group with that one, e.g. "rebuild the UTG open, then answer
// hands from it". Only exercises that aren't in a group yet are grouped.
export function groupByCharts(
  items: ItemDraft[],
  manifest: RangeInfo[],
  game: string,
  stack: number
): ItemDraft[] {
  const urls = (exercise: ExerciseDraft) => resolveUrls(filterOf(exercise), manifest, game, stack);
  const result: ItemDraft[] = [];
  const made = new Set<ItemDraft>();
  for (const item of items) {
    const previous = result[result.length - 1];
    const last = made.has(previous) ? (previous as GroupDraft).items.at(-1) : previous;
    const joins =
      item.kind === "hands" &&
      last !== undefined &&
      last.kind !== "group" &&
      urls(item).some((url) => urls(last).includes(url));
    if (!joins) {
      result.push(item);
    } else if (previous === last) {
      const group = blankGroup([last, item]);
      group.name = pickName(last);
      made.add(group);
      result[result.length - 1] = group;
    } else {
      (previous as GroupDraft).items.push(item);
    }
  }
  return result;
}

// A collapsed exercise in a few words, like "Rebuild once · UTG · RFI" or
// "10 hands · BB · vs RFI · CO".
export function describeDraft(exercise: ExerciseDraft): string {
  const task =
    exercise.kind === "hands"
      ? `${exercise.count} ${exercise.count === 1 ? "hand" : "hands"}`
      : `Rebuild ${
          exercise.timesInARow === 1
            ? "once"
            : exercise.timesInARow === 2
              ? "twice"
              : `${exercise.timesInARow} times in a row`
        }`;
  return `${task} · ${pickName(exercise) || "all charts"}`;
}

// A group's name from its charts, like "UTG · RFI" or "BB · vs RFI · CO".
function pickName(exercise: ExerciseDraft): string {
  return exercise.picks
    .map((pick) =>
      [pick.positions, pick.types, pick.opponents]
        .filter((list) => list.length > 0)
        .map((list) => list.join(", "))
        .join(" · ")
    )
    .join(" + ");
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
  items: ItemDraft[],
  manifest: RangeInfo[],
  game: string,
  stack: number
): string[] {
  const list: string[] = [];
  const exercises = exercisesIn(items);
  if (exercises.length === 0) list.push("Add at least one exercise.");
  exercises.forEach((exercise, index) => {
    if (chartCount(exercise, manifest, game, stack) === 0) {
      list.push(`Exercise ${index + 1} has no charts.`);
    }
  });
  const emptyGroups = (items: ItemDraft[]): number =>
    items.reduce(
      (sum, item) =>
        sum + (item.kind === "group" ? (item.items.length === 0 ? 1 : 0) + emptyGroups(item.items) : 0),
      0
    );
  if (emptyGroups(items) > 0) list.push("Put an exercise in each group, or remove the empty ones.");
  return list;
}
