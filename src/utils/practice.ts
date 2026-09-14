import { Action, PokerRange, PokerRangeLength } from "./range.svelte";

export type Question = { range: PokerRange; hand: number };

// An empty grid to fill in. Hands outside the answer's range (null) stay
// empty, since there is no action to learn for them.
export function blankRangeFor(answer?: PokerRange): PokerRange {
  if (!answer) return new PokerRange();
  return new PokerRange(
    undefined,
    answer.range.map((action) => (action === null ? null : Action.Fold))
  );
}

// Hands outside the answer's range (null) have no answer, so they don't count.
export function isRangeCorrect(attempt: PokerRange, answer: PokerRange) {
  return answer.range.every(
    (action, index) => action === null || attempt.range[index] === action
  );
}

function mostCommonAction(range: PokerRange): Action | null {
  const counts = new Map<Action, number>();
  for (const action of range.range) {
    if (action !== null) counts.set(action, (counts.get(action) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

// Hands next to a hand with a different action sit on the edge of a region,
// which is where mistakes happen, so they are picked more often.
function weight(range: PokerRange, hand: number, common: Action | null) {
  const action = range.range[hand];
  const row = Math.floor(hand / 13);
  const col = hand % 13;
  const neighbors = [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ]
    .filter(([r, c]) => r >= 0 && r < 13 && c >= 0 && c < 13)
    .map(([r, c]) => range.range[r * 13 + c]);
  if (neighbors.some((other) => other !== null && other !== action)) return 4;
  return action === common ? 1 : 2;
}

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

// Every in-range hand of every range in random order, or `count` of them
// favoring hands on the edge of a region.
export function pickQuestions(ranges: PokerRange[], count?: number): Question[] {
  const candidates: { question: Question; key: number }[] = [];
  for (const range of ranges) {
    const common = mostCommonAction(range);
    for (let hand = 0; hand < PokerRangeLength; hand++) {
      if (range.range[hand] === null) continue;
      const w = count === undefined ? 1 : weight(range, hand, common);
      // Weighted sampling without replacement: keep the largest random^(1/w).
      candidates.push({ question: { range, hand }, key: Math.random() ** (1 / w) });
    }
  }
  candidates.sort((a, b) => b.key - a.key);
  return shuffle(
    candidates.slice(0, count ?? candidates.length).map((c) => c.question)
  );
}
