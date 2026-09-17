import {
  resolveDrill,
  resolveUrls,
  type Drill,
  type ExerciseTemplate,
  type RangeFilter,
} from "./drills";
import type { RangeInfo } from "./manifest";

export type Lesson = {
  // Stable id; saved progress refers to it.
  id: string;
  title: string;
  // Defaults to the course's stack.
  stack?: number;
  // Paragraphs of explanation. Numbers belong in the chart table, not here.
  body: string[];
  // Charts summarized in a table under the text.
  stats?: RangeFilter;
  exercises: ExerciseTemplate[];
};

export type Course = {
  id: string;
  name: string;
  description: string;
  game: string;
  stack: number;
  lessons: Lesson[];
};

export function lessonStack(course: Course, lesson: Lesson) {
  return lesson.stack ?? course.stack;
}

export function resolveLesson(
  course: Course,
  lesson: Lesson,
  manifest: RangeInfo[]
): Drill | null {
  return resolveDrill(
    { name: lesson.title, description: "", exercises: lesson.exercises },
    manifest,
    course.game,
    lessonStack(course, lesson)
  );
}

export function lessonStatsUrls(
  course: Course,
  lesson: Lesson,
  manifest: RangeInfo[]
): string[] {
  if (!lesson.stats) return [];
  return resolveUrls(lesson.stats, manifest, course.game, lessonStack(course, lesson));
}

// Hands in the wider quiz that closes a lesson about a single spot.
const MIXED_HANDS = 40;

// A lesson drills harder than a drill does: rebuild each chart until it's right
// `times` in a row, answer `hands` hands from those charts, and then answer hands
// drawn from every chart of the same situation at this stack, so the spot is
// practiced among its neighbours instead of on its own.
function learn(filter: RangeFilter, times: number, hands: number): ExerciseTemplate[] {
  return [
    { kind: "range", filter, timesInARow: times },
    { kind: "hands", filter, count: hands },
    // Build the charts once more, now that the hands have shown you their edges.
    { kind: "range", filter, timesInARow: 1 },
    ...mixedQuiz(filter),
  ];
}

// A review lesson: rebuild charts from earlier lessons, then answer hands drawn
// from everything the course has covered up to here.
function review(
  rebuild: RangeFilter,
  recall: RangeFilter,
  hands: number
): ExerciseTemplate[] {
  return [
    { kind: "range", filter: rebuild, timesInARow: 1 },
    { kind: "hands", filter: recall, count: hands },
  ];
}

// A lesson that only reviews charts the course has already taught.
function quiz(filter: RangeFilter, hands: number): ExerciseTemplate[] {
  return [{ kind: "hands", filter, count: hands }, ...mixedQuiz(filter)];
}

// Nothing to widen when the lesson already covers its whole situation.
function mixedQuiz(filter: RangeFilter): ExerciseTemplate[] {
  const narrowed = (filter.positions?.length ?? 0) + (filter.opponents?.length ?? 0) > 0;
  if (!narrowed) return [];
  return [{ kind: "hands", filter: { types: filter.types }, count: MIXED_HANDS }];
}

const TABLE_NOTE =
  "The table shows how each chart splits its hands between actions.";

export const courses: Course[] = [
  {
    id: "cash-100",
    name: "Cash game preflop",
    description:
      "From opening ranges to facing 4-bets, at 100bb stacks. Start here if you play cash games.",
    game: "cash",
    stack: 100,
    lessons: [
      {
        id: "position",
        title: "Position and opening ranges",
        body: [
          "Raise first in (RFI) means everyone before you folded and you are the first to put money in the pot. Every player still to act can wake up with a strong hand, and the players after you also act after you on every street after the flop.",
          "So the earlier your seat, the tighter your opening range. " +
            TABLE_NOTE +
            " Compare UTG with the button.",
          "Start with the two earliest seats.",
        ],
        stats: { types: ["RFI"] },
        exercises: learn({ types: ["RFI"], positions: ["UTG", "UTG+1"] }, 2, 60),
      },
      {
        id: "middle-opens",
        title: "Opening from the middle",
        body: [
          "The lojack (LJ) and hijack (HJ) have fewer players left to act than UTG, so they open more hands.",
          "While you rebuild these charts, notice which hands get added compared with the earlier seats.",
        ],
        stats: { types: ["RFI"], positions: ["UTG+1", "LJ", "HJ"] },
        exercises: learn({ types: ["RFI"], positions: ["LJ", "HJ"] }, 2, 60),
      },
      {
        id: "late-opens",
        title: "Opening from late position",
        body: [
          "From the cutoff (CO) only the button and the blinds are left, and from the button only the blinds. The button also acts last on every street after the flop.",
          "That makes these the widest opening ranges at the table.",
        ],
        stats: { types: ["RFI"], positions: ["HJ", "CO", "BTN"] },
        exercises: learn({ types: ["RFI"], positions: ["CO", "BTN"] }, 2, 60),
      },
      {
        id: "small-blind",
        title: "The small blind",
        body: [
          "When it folds to the small blind, only the big blind is left. But the small blind is out of position for the rest of the hand, so it doesn't simply raise everything it plays.",
          "Look at the table: this chart limps (calls) as well as raising. Pay attention to which hands raise and which limp.",
        ],
        stats: { types: ["RFI"], positions: ["SB"] },
        exercises: learn({ types: ["RFI"], positions: ["SB"] }, 2, 80),
      },
      {
        id: "review-opens",
        title: "Review: opening ranges",
        body: [
          "Nothing new here, and no table to read: rebuilding a chart after you have started to forget it is what moves it into long-term memory, so the course comes back to earlier material every few lessons.",
          "Rebuild four of the opening charts from memory, then answer hands from every seat that opens. A chart or a hand you get wrong comes back immediately and again at the end, so whatever has faded most gets the most repetitions.",
        ],
        exercises: review(
          { types: ["RFI"], positions: ["UTG", "HJ", "BTN", "SB"] },
          { types: ["RFI"] },
          100
        ),
      },
      {
        id: "bb-vs-late",
        title: "Big blind defense against late opens",
        body: [
          "The big blind already has 1bb in the pot, so calling an open costs less than from any other seat, and nobody acts after you preflop.",
          "Late-position players open wide, so the big blind can continue with many hands against them. " +
            TABLE_NOTE +
            " Compare the openers from UTG to the small blind.",
        ],
        stats: { types: ["vs RFI"], positions: ["BB"] },
        exercises: learn(
          { types: ["vs RFI"], positions: ["BB"], opponents: ["CO", "BTN"] },
          2,
          80
        ),
      },
      {
        id: "bb-vs-early",
        title: "Big blind defense against early opens",
        body: [
          "An open from an early seat comes from a much stronger range. A hand that defends against the button can be a fold against UTG.",
          "Rebuild these charts and compare them with the ones from the last lesson.",
        ],
        stats: { types: ["vs RFI"], positions: ["BB"] },
        exercises: learn(
          { types: ["vs RFI"], positions: ["BB"], opponents: ["UTG", "UTG+1", "LJ", "HJ"] },
          1,
          80
        ),
      },
      {
        id: "blind-vs-blind",
        title: "Blind vs blind",
        body: [
          "When everyone folds to the small blind, only the blinds are left. As you saw earlier, the small blind both raises and limps.",
          "This lesson covers the big blind's answer to each: facing a raise and facing a limp.",
        ],
        stats: { types: ["vs RFI", "vs limp"], positions: ["BB"], opponents: ["SB"] },
        exercises: learn(
          { types: ["vs RFI", "vs limp"], positions: ["BB"], opponents: ["SB"] },
          2,
          80
        ),
      },
      {
        id: "btn-vs-open",
        title: "Facing an open on the button",
        body: [
          "On the button you will play the rest of the hand in position. Against an open you can 3-bet, call, or fold.",
          "Compare the charts against early and late openers: the later the opener, the wider their range and the more hands you continue with.",
        ],
        stats: { types: ["vs RFI"], positions: ["BTN"] },
        exercises: learn({ types: ["vs RFI"], positions: ["BTN"] }, 1, 80),
      },
      {
        id: "sb-vs-open",
        title: "Facing an open from the small blind",
        body: [
          "The small blind is out of position against every opener, and the big blind can still act behind you.",
          TABLE_NOTE + " Compare how often the small blind 3-bets with how often it calls.",
        ],
        stats: { types: ["vs RFI"], positions: ["SB"] },
        exercises: quiz({ types: ["vs RFI"], positions: ["SB"] }, 80),
      },
      {
        id: "review-defense",
        title: "Review: opening and defending",
        body: [
          "Defense charts fade faster than opening charts, because there is a different one for every opener you can face.",
          "Rebuild the big blind against an early open and against the button, then answer hands from everything so far: opens, limps and defense. A chart or a hand you get wrong comes back immediately and again at the end, so whatever has faded most gets the most repetitions.",
        ],
        exercises: review(
          { types: ["vs RFI"], positions: ["BB"], opponents: ["UTG", "BTN"] },
          { types: ["RFI", "vs RFI", "vs limp"] },
          120
        ),
      },
      {
        id: "vs-3bet-late",
        title: "When your late open gets 3-bet",
        body: [
          "These charts only contain the hands you opened with. Hands you would have folded preflop are left empty in the grid, and the table's first column shows how many hands reach the spot.",
          "Against a 3-bet you can 4-bet, call, or fold.",
        ],
        stats: { types: ["vs 3-bet"], positions: ["CO", "BTN"] },
        exercises: learn({ types: ["vs 3-bet"], positions: ["CO", "BTN"] }, 1, 80),
      },
      {
        id: "vs-3bet-early",
        title: "When your early open gets 3-bet",
        body: [
          "An open from UTG is already a strong range, and fewer hands reach this spot. Compare the Fold column with the late-open charts from the last lesson.",
          "There are many charts here, one per opponent, so this lesson is a hand quiz.",
        ],
        stats: { types: ["vs 3-bet"], positions: ["UTG"] },
        exercises: quiz({ types: ["vs 3-bet"], positions: ["UTG", "UTG+1"] }, 80),
      },
      {
        id: "review-3bets",
        title: "Review: 3-bets and everything before them",
        body: [
          "Facing a 3-bet is where the earlier charts matter most: what you can continue with depends on how wide you opened in the first place.",
          "Rebuild the button against a big blind 3-bet, then answer hands drawn from the whole course so far.",
        ],
        exercises: review(
          { types: ["vs 3-bet"], positions: ["BTN"], opponents: ["BB"] },
          { types: ["RFI", "vs RFI", "vs limp", "vs 3-bet"] },
          120
        ),
      },
      {
        id: "vs-4bet",
        title: "Facing a 4-bet",
        body: [
          "You 3-bet and got 4-bet. Only a narrow part of your range is left, and the pot is already big.",
          "This hand quiz mixes every position.",
        ],
        exercises: quiz({ types: ["vs 4-bet"] }, 80),
      },
      {
        id: "cash-final",
        title: "Final exam",
        body: [
          "Three charts to rebuild from memory, then hands from every chart in this course: opens, facing an open, blind vs blind, and facing 3-bets.",
        ],
        exercises: review(
          { types: ["RFI"], positions: ["UTG", "BTN", "SB"] },
          { types: ["RFI", "vs RFI", "vs limp", "vs 3-bet"] },
          160
        ),
      },
    ],
  },
  {
    id: "mtt-30",
    name: "Tournament preflop",
    description:
      "Opening, defending and facing 3-bets and shoves with 30bb stacks, the middle stage of most tournaments.",
    game: "mtt",
    stack: 30,
    lessons: [
      {
        id: "opens-early",
        title: "Opening from early position",
        body: [
          "The basics are the same as in cash games: the earlier your seat, the more players can wake up with a strong hand behind you, so the tighter you open.",
          TABLE_NOTE + " Start with the three earliest seats.",
        ],
        stats: { types: ["RFI"] },
        exercises: learn({ types: ["RFI"], positions: ["UTG", "UTG+1", "LJ"] }, 1, 60),
      },
      {
        id: "opens-late",
        title: "Opening from late position and the small blind",
        body: [
          "From the hijack onwards the ranges get much wider. The small blind has only the big blind left, but plays the rest of the hand out of position.",
        ],
        stats: { types: ["RFI"], positions: ["HJ", "CO", "BTN", "SB"] },
        exercises: learn({ types: ["RFI"], positions: ["HJ", "CO", "BTN", "SB"] }, 1, 80),
      },
      {
        id: "review-opens",
        title: "Review: opening ranges",
        body: [
          "Nothing new here, and no table to read: rebuilding a chart after you have started to forget it is what moves it into long-term memory, so the course comes back to earlier material every few lessons.",
          "Rebuild three of the 30bb opening charts from memory, then answer hands from every seat that opens. A chart or a hand you get wrong comes back immediately and again at the end, so whatever has faded most gets the most repetitions.",
        ],
        exercises: review(
          { types: ["RFI"], positions: ["UTG", "CO", "BTN"] },
          { types: ["RFI"] },
          100
        ),
      },
      {
        id: "bb-vs-late",
        title: "Big blind defense against late opens",
        body: [
          "In tournaments with antes, the pot is bigger before anyone acts, so the big blind gets an even better price to call than in a cash game.",
          TABLE_NOTE + " Compare how the big blind continues against each opener.",
        ],
        stats: { types: ["vs RFI"], positions: ["BB"] },
        exercises: learn(
          { types: ["vs RFI"], positions: ["BB"], opponents: ["CO", "BTN", "SB"] },
          1,
          80
        ),
      },
      {
        id: "bb-vs-early",
        title: "Big blind defense against early opens",
        body: [
          "Early opens are stronger, so the big blind folds more of the same hands it defends against late opens.",
        ],
        stats: { types: ["vs RFI"], positions: ["BB"], opponents: ["UTG", "UTG+1", "LJ", "HJ"] },
        exercises: learn(
          { types: ["vs RFI"], positions: ["BB"], opponents: ["UTG", "UTG+1", "LJ", "HJ"] },
          1,
          80
        ),
      },
      {
        id: "btn-vs-open",
        title: "Facing an open on the button",
        body: [
          "On the button you play in position after the flop. Against an open you can 3-bet, call, or fold.",
        ],
        stats: { types: ["vs RFI"], positions: ["BTN"] },
        exercises: learn({ types: ["vs RFI"], positions: ["BTN"] }, 1, 80),
      },
      {
        id: "sb-vs-open",
        title: "Facing an open from the small blind",
        body: [
          "The small blind is out of position with the big blind still to act. " +
            TABLE_NOTE,
        ],
        stats: { types: ["vs RFI"], positions: ["SB"] },
        exercises: quiz({ types: ["vs RFI"], positions: ["SB"] }, 80),
      },
      {
        id: "review-defense",
        title: "Review: opening and defending",
        body: [
          "The big blind defends very wide at 30bb with antes, and those charts are the ones that slip first.",
          "Rebuild two of them, then answer hands from every opening and defense chart in the course so far.",
        ],
        exercises: review(
          { types: ["vs RFI"], positions: ["BB"], opponents: ["UTG", "BTN"] },
          { types: ["RFI", "vs RFI"] },
          120
        ),
      },
      {
        id: "vs-3bet",
        title: "When your late open gets 3-bet",
        body: [
          "These charts only contain the hands you opened with; the others are left empty. The first column of the table shows how many hands reach the spot.",
        ],
        stats: { types: ["vs 3-bet"], positions: ["CO", "BTN", "SB"] },
        exercises: learn({ types: ["vs 3-bet"], positions: ["CO", "BTN", "SB"] }, 1, 80),
      },
      {
        id: "vs-3bet-shove",
        title: "Facing a 3-bet shove",
        body: [
          "When someone 3-bets all-in, you can only call or fold. There's no more betting after this, so the only question is whether your hand is strong enough to call for your stack.",
        ],
        exercises: quiz({ types: ["vs 3-bet all-in"] }, 80),
      },
      {
        id: "vs-4bet-shove",
        title: "Facing a 4-bet shove",
        body: [
          "You 3-bet and the opener moved all-in. Again it's call or fold, now against a range that was strong enough to open and then shove.",
        ],
        exercises: quiz({ types: ["vs 4-bet all-in"] }, 80),
      },
      {
        id: "review-shoves",
        title: "Review: facing shoves",
        body: [
          "The charts for facing a shove only call or fold, which makes them easy to mix up with the spots where raising is still an option.",
          "Rebuild the small blind's opening chart to keep it fresh, then answer hands from the 3-bet shove and 4-bet shove charts.",
        ],
        exercises: review(
          { types: ["RFI"], positions: ["SB"] },
          { types: ["vs 3-bet all-in", "vs 4-bet all-in"] },
          120
        ),
      },
      {
        id: "mtt-30-final",
        title: "Final exam",
        body: [
          "Two charts to rebuild from memory, then hands from the opening, facing-an-open and 3-bet charts in this course.",
        ],
        exercises: review(
          { types: ["RFI"], positions: ["UTG", "BTN"] },
          { types: ["RFI", "vs RFI", "vs 3-bet"] },
          160
        ),
      },
    ],
  },
  {
    id: "short-stack",
    name: "Short-stack tournaments",
    description:
      "Playing 20bb and 12bb stacks, where all-ins become a big part of preflop play.",
    game: "mtt",
    stack: 20,
    lessons: [
      {
        id: "20-opens-early",
        title: "Opening at 20bb: early position",
        body: [
          "With 20bb, every open risks a big part of your stack if someone shoves. " +
            TABLE_NOTE +
            " Compare it with the 30bb charts if you took the tournament course.",
        ],
        stats: { types: ["RFI"] },
        exercises: learn({ types: ["RFI"], positions: ["UTG", "UTG+1", "LJ"] }, 1, 60),
      },
      {
        id: "20-opens-late",
        title: "Opening at 20bb: late position",
        body: ["The hijack, cutoff, button and small blind at 20bb."],
        stats: { types: ["RFI"], positions: ["HJ", "CO", "BTN", "SB"] },
        exercises: learn({ types: ["RFI"], positions: ["HJ", "CO", "BTN", "SB"] }, 1, 80),
      },
      {
        id: "review-20-opens",
        title: "Review: opening at 20bb",
        body: [
          "Nothing new here, and no table to read: rebuilding a chart after you have started to forget it is what moves it into long-term memory, so the course comes back to earlier material every few lessons.",
          "Rebuild two of the 20bb opening charts from memory, then answer hands from every seat that opens at this stack. A chart or a hand you get wrong comes back immediately and again at the end, so whatever has faded most gets the most repetitions.",
        ],
        exercises: review(
          { types: ["RFI"], positions: ["UTG", "BTN"] },
          { types: ["RFI"] },
          100
        ),
      },
      {
        id: "20-bb",
        title: "Big blind at 20bb",
        body: [
          "The big blind facing an open from the button or the small blind, the most common spots at a short-handed or short-stacked table.",
        ],
        stats: { types: ["vs RFI"], positions: ["BB"] },
        exercises: learn(
          { types: ["vs RFI"], positions: ["BB"], opponents: ["BTN", "SB"] },
          2,
          80
        ),
      },
      {
        id: "20-open-shoves",
        title: "Facing an open shove at 20bb",
        body: [
          "When a player opens all-in, you can only call or fold. The shover's range is wide when they're in late position, but calling risks your tournament.",
        ],
        stats: { types: ["vs all-in"] },
        exercises: learn({ types: ["vs all-in"] }, 1, 60),
      },
      {
        id: "20-3bet-shoves",
        title: "Facing a 3-bet shove at 20bb",
        body: ["You opened and got 3-bet all-in. This hand quiz covers every position."],
        exercises: quiz({ types: ["vs 3-bet all-in"] }, 80),
      },
      {
        id: "review-20",
        title: "Review: the whole 20bb game",
        body: [
          "Everything you have done at 20bb in one lesson, before the stacks get shorter and the charts change again.",
          "Rebuild an early and a late opening chart, then answer hands from the opening, big blind and shove-facing charts at 20bb.",
        ],
        exercises: review(
          { types: ["RFI"], positions: ["UTG+1", "CO"] },
          { types: ["RFI", "vs RFI", "vs all-in", "vs 3-bet all-in"] },
          120
        ),
      },
      {
        id: "12-opens-early",
        title: "Opening at 12bb: early position",
        stack: 12,
        body: [
          "At 12bb these charts use a mix of small raises and all-ins. Look at the All in column in the table, and while you rebuild the charts, notice which hands shove and which raise.",
        ],
        stats: { types: ["RFI"] },
        exercises: learn({ types: ["RFI"], positions: ["UTG", "UTG+1", "LJ"] }, 1, 60),
      },
      {
        id: "12-opens-late",
        title: "Opening at 12bb: late position",
        stack: 12,
        body: ["The hijack, cutoff and button at 12bb."],
        stats: { types: ["RFI"], positions: ["HJ", "CO", "BTN"] },
        exercises: learn({ types: ["RFI"], positions: ["HJ", "CO", "BTN"] }, 1, 60),
      },
      {
        id: "12-bb-vs-shove",
        title: "Big blind facing a shove at 12bb",
        stack: 12,
        body: [
          "The big blind already has 1bb in and the antes are in the pot, so it gets a good price to call a shove from late position.",
        ],
        stats: { types: ["vs all-in"], positions: ["BB"] },
        exercises: learn(
          { types: ["vs all-in"], positions: ["BB"], opponents: ["CO", "BTN", "SB"] },
          1,
          60
        ),
      },
      {
        id: "12-calling-shoves",
        title: "Calling shoves at 12bb",
        stack: 12,
        body: ["Facing an open shove from every seat."],
        exercises: quiz({ types: ["vs all-in"] }, 80),
      },
      {
        id: "short-final",
        title: "Final exam",
        stack: 12,
        body: [
          "Two charts to rebuild from memory, then hands from the 12bb opening and shove-calling charts.",
        ],
        exercises: review(
          { types: ["RFI"], positions: ["UTG", "BTN"] },
          { types: ["RFI", "vs all-in"] },
          160
        ),
      },
    ],
  },
];
