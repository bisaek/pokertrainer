import { positionOrder, rangeUrl, typeOrder, type RangeInfo } from "./manifest";
import type { ExerciseSettings, MistakeMode } from "./settings.svelte";

// Which ranges an exercise uses. An omitted or empty list means all of them.
export type RangeFilter = {
  types: string[];
  positions?: string[];
  opponents?: string[];
};

// An exercise's charts: those matching one filter, or any of a list of them,
// so opens from every seat and the big blind's defense can share a quiz.
export type ChartPick = RangeFilter | RangeFilter[];

// What an exercise says about the trainer's options: values it sets, and
// whether the player may change them meanwhile. Unset options are the player's.
export type ExerciseRules = { settings?: ExerciseSettings };

// How a hand quiz treats a wrong answer; unset means ask again, and once
// more at the end.
export type HandRules = { mistakes?: MistakeMode; repeatMistakes?: boolean };

export type ExerciseTemplate =
  | ({ kind: "range"; filter: ChartPick; timesInARow: number } & ExerciseRules)
  | ({ kind: "hands"; filter: ChartPick; count: number } & ExerciseRules & HandRules);

// How a drill runs its exercises. An exercise that answers hands from the
// same charts as the one before it goes with it (see exerciseBlocks), so
// "rebuild the UTG open, then answer hands from it" stays together.
export type DrillOrder = {
  // Play the blocks in a random order.
  shuffle?: boolean;
  // A block with a mistake in it is done again at the end, until it is done
  // without one.
  redoMistakes?: boolean;
};

export type DrillTemplate = DrillOrder & {
  name: string;
  description: string;
  exercises: ExerciseTemplate[];
  // Hide the drill when fewer charts exist, e.g. a review of a single chart.
  minCharts?: number;
};

export type DrillExercise =
  | ({ kind: "range"; urls: string[]; timesInARow: number } & ExerciseRules)
  | ({ kind: "hands"; urls: string[]; count: number } & ExerciseRules & HandRules);

export type Drill = DrillOrder & {
  name: string;
  description: string;
  chartCount: number;
  exercises: DrillExercise[];
};

const EARLY = ["UTG", "UTG+1", "UTG+2"];
const MIDDLE = ["LJ", "MP", "HJ"];
const OPENERS = ["UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN", "SB"];
const RESPONDERS = ["UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN", "SB", "BB"];

// Rebuild each chart until it's right `times` in a row, then answer hands from them.
export function learn(filter: RangeFilter, times: number, hands: number): ExerciseTemplate[] {
  return [
    { kind: "range", filter, timesInARow: times },
    { kind: "hands", filter, count: hands },
  ];
}

export function quiz(filter: RangeFilter, hands: number): ExerciseTemplate[] {
  return [{ kind: "hands", filter, count: hands }];
}

// One drill per position, so a drill has at most one chart per opponent.
function perPosition(
  positions: string[],
  types: string[],
  name: (position: string) => string,
  description: (position: string) => string
): DrillTemplate[] {
  return positions.map((position) => ({
    name: name(position),
    description: description(position),
    exercises: learn({ types, positions: [position] }, 1, 40),
  }));
}

function review(name: string, description: string, types: string[]): DrillTemplate {
  return { name, description, exercises: quiz({ types }, 60), minCharts: 2 };
}

export const drillCategories: { name: string; drills: DrillTemplate[] }[] = [
  {
    name: "Opening ranges",
    drills: [
      ...["UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN"].map((position) => ({
        name: `${position} open`,
        description: `Which hands to open when it folds to you in ${position}.`,
        exercises: learn({ types: ["RFI"], positions: [position] }, 2, 30),
      })),
      {
        name: "SB open",
        description: "Which hands to raise, limp or fold when it folds to you in the small blind.",
        exercises: learn({ types: ["RFI"], positions: ["SB"] }, 2, 40),
      },
      {
        name: "Early position opens",
        description: "UTG to LJ, mixed together.",
        exercises: learn({ types: ["RFI"], positions: [...EARLY, "LJ"] }, 1, 40),
        minCharts: 2,
      },
      {
        name: "Late position opens",
        description: "HJ, CO, BTN and SB, mixed together.",
        exercises: learn({ types: ["RFI"], positions: ["HJ", "CO", "BTN", "SB"] }, 1, 40),
        minCharts: 2,
      },
      {
        name: "All opens",
        description: "Every opening range once, then a hand quiz.",
        exercises: learn({ types: ["RFI"] }, 1, 60),
        minCharts: 2,
      },
    ],
  },
  {
    name: "Big blind defense",
    drills: [
      {
        name: "BB vs early opens",
        description: "Facing an open from UTG or UTG+1.",
        exercises: learn({ types: ["vs RFI"], positions: ["BB"], opponents: EARLY }, 1, 40),
      },
      {
        name: "BB vs middle opens",
        description: "Facing an open from LJ or HJ.",
        exercises: learn({ types: ["vs RFI"], positions: ["BB"], opponents: MIDDLE }, 1, 40),
      },
      {
        name: "BB vs CO open",
        description: "Facing an open from the cutoff.",
        exercises: learn({ types: ["vs RFI"], positions: ["BB"], opponents: ["CO"] }, 2, 30),
      },
      {
        name: "BB vs BTN open",
        description: "Facing an open from the button.",
        exercises: learn({ types: ["vs RFI"], positions: ["BB"], opponents: ["BTN"] }, 2, 30),
      },
      {
        name: "BB vs SB",
        description: "Facing a small blind raise or limp.",
        exercises: learn(
          { types: ["vs RFI", "vs limp"], positions: ["BB"], opponents: ["SB"] },
          1,
          40
        ),
      },
      {
        name: "BB defense review",
        description: "Hands from every big blind defense chart.",
        exercises: quiz({ types: ["vs RFI", "vs limp"], positions: ["BB"] }, 60),
        minCharts: 2,
      },
    ],
  },
  {
    name: "Facing an open",
    drills: [
      ...perPosition(
        ["SB", "BTN", "CO", "HJ"],
        ["vs RFI"],
        (position) => `${position} vs opens`,
        (position) => `${position} facing an open from any position.`
      ),
      {
        name: "Early positions vs opens",
        description: "UTG+1 to LJ facing an open.",
        exercises: learn({ types: ["vs RFI"], positions: ["UTG+1", "UTG+2", "LJ"] }, 1, 40),
      },
      {
        name: "Facing opens review",
        description: "Hands from every position except the big blind.",
        exercises: quiz({ types: ["vs RFI"], positions: OPENERS }, 60),
        minCharts: 2,
      },
    ],
  },
  {
    name: "Facing an open shove",
    drills: [
      ...perPosition(
        [...RESPONDERS].reverse(),
        ["vs all-in"],
        (position) => `${position} vs open shoves`,
        (position) => `Calling an all-in open from ${position}.`
      ),
      review("Open shoves review", "Hands from every open shove chart.", ["vs all-in"]),
    ],
  },
  {
    name: "Facing a 3-bet",
    drills: [
      ...perPosition(
        OPENERS,
        ["vs 3-bet"],
        (position) => `${position} open vs 3-bets`,
        (position) => `You opened from ${position} and got 3-bet.`
      ),
      review("Facing 3-bets review", "Hands from every 3-bet chart.", ["vs 3-bet"]),
    ],
  },
  {
    name: "Facing a 3-bet shove",
    drills: [
      ...perPosition(
        OPENERS,
        ["vs 3-bet all-in"],
        (position) => `${position} open vs 3-bet shoves`,
        (position) => `You opened from ${position} and got 3-bet all-in.`
      ),
      review("3-bet shoves review", "Hands from every 3-bet shove chart.", ["vs 3-bet all-in"]),
    ],
  },
  {
    name: "Facing a 4-bet",
    drills: [
      ...perPosition(
        RESPONDERS,
        ["vs 4-bet"],
        (position) => `${position} 3-bet vs 4-bets`,
        (position) => `You 3-bet from ${position} and got 4-bet.`
      ),
      review("Facing 4-bets review", "Hands from every 4-bet chart.", ["vs 4-bet"]),
    ],
  },
  {
    name: "Facing a 4-bet shove",
    drills: [
      ...perPosition(
        RESPONDERS,
        ["vs 4-bet all-in"],
        (position) => `${position} 3-bet vs 4-bet shoves`,
        (position) => `You 3-bet from ${position} and got 4-bet all-in.`
      ),
      review("4-bet shoves review", "Hands from every 4-bet shove chart.", ["vs 4-bet all-in"]),
    ],
  },
  {
    name: "Facing 5-bets and 6-bets",
    drills: [
      {
        name: "Facing 5-bets and 6-bets",
        description: "Hands from every 5-bet and 6-bet chart.",
        exercises: quiz({ types: ["vs 5-bet", "vs 5-bet all-in", "vs 6-bet", "vs 6-bet all-in"] }, 50),
      },
    ],
  },
];

function matches(range: RangeInfo, pick: ChartPick): boolean {
  if (Array.isArray(pick)) return pick.some((filter) => matches(range, filter));
  const filter = pick;
  return (
    (filter.types.length === 0 || filter.types.includes(range.type)) &&
    (!filter.positions?.length || filter.positions.includes(range.position)) &&
    (!filter.opponents?.length ||
      range.opponent === null ||
      filter.opponents.includes(range.opponent))
  );
}

function compareRanges(a: RangeInfo, b: RangeInfo) {
  return (
    positionOrder.indexOf(a.position) - positionOrder.indexOf(b.position) ||
    positionOrder.indexOf(a.opponent ?? "") - positionOrder.indexOf(b.opponent ?? "") ||
    typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type)
  );
}

// URLs of the charts matching a filter for a game and stack, in table order.
export function resolveUrls(
  filter: ChartPick,
  manifest: RangeInfo[],
  game: string,
  stack: number
): string[] {
  return manifest
    .filter((range) => range.game === game && range.stack === stack && matches(range, filter))
    .sort(compareRanges)
    .map(rangeUrl);
}

// Turns a drill template into the ranges that exist for a game and stack.
// Exercises without ranges are dropped, and the drill is null when nothing is left.
export function resolveDrill(
  drill: DrillTemplate,
  manifest: RangeInfo[],
  game: string,
  stack: number
): Drill | null {
  const exercises: DrillExercise[] = [];
  for (const exercise of drill.exercises) {
    const urls = resolveUrls(exercise.filter, manifest, game, stack);
    if (urls.length === 0) continue;
    exercises.push(
      exercise.kind === "range"
        ? { kind: "range", urls, timesInARow: exercise.timesInARow, settings: exercise.settings }
        : {
            kind: "hands",
            urls,
            count: exercise.count,
            settings: exercise.settings,
            mistakes: exercise.mistakes,
            repeatMistakes: exercise.repeatMistakes,
          }
    );
  }
  const chartCount = new Set(exercises.flatMap((exercise) => exercise.urls)).size;
  if (exercises.length === 0 || chartCount < (drill.minCharts ?? 1)) return null;
  return {
    name: drill.name,
    description: drill.description,
    chartCount,
    exercises,
    shuffle: drill.shuffle,
    redoMistakes: drill.redoMistakes,
  };
}

// The drill's exercises split into blocks that are played, shuffled and done
// again together: an exercise answering hands joins the one before it when
// they share a chart. Each block is a list of indices into the exercises.
export function exerciseBlocks(exercises: DrillExercise[]): number[][] {
  const blocks: number[][] = [];
  exercises.forEach((exercise, index) => {
    const previous = exercises[index - 1];
    const joins =
      exercise.kind === "hands" &&
      previous !== undefined &&
      exercise.urls.some((url) => previous.urls.includes(url));
    if (joins) blocks[blocks.length - 1].push(index);
    else blocks.push([index]);
  });
  return blocks;
}

export function describeExercise(exercise: DrillExercise): string {
  if (exercise.kind === "hands") return `answer ${exercise.count} hands`;
  if (exercise.timesInARow === 1) return "rebuild each chart once";
  const times =
    exercise.timesInARow === 2 ? "twice" : `${exercise.timesInARow} times`;
  return `rebuild each chart ${times} in a row`;
}
