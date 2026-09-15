// Summarizes a chart the way the trainers see it: one action per hand.

const ACTION_ORDER = ["All in", "Raise", "Call", "Fold"];

export type ActionShare = { action: string; percent: number };

// Hand combinations for a grid cell: 6 for a pair, 4 suited (above the diagonal), 12 offsuit.
function combos(index: number) {
  const row = Math.floor(index / 13);
  const col = index % 13;
  if (row === col) return 6;
  return col > row ? 4 : 12;
}

// Share of each action among the hands in the chart (cells that aren't null), weighted
// by combinations, and how much of all 1326 starting hands reach the spot.
export function actionShares(range: (string | null)[]): {
  reach: number;
  shares: ActionShare[];
} {
  let total = 0;
  const counts = new Map<string, number>();
  range.forEach((action, index) => {
    if (action === null) return;
    const count = combos(index);
    total += count;
    counts.set(action, (counts.get(action) ?? 0) + count);
  });
  const rank = (action: string) =>
    ACTION_ORDER.includes(action) ? ACTION_ORDER.indexOf(action) : ACTION_ORDER.length;
  const shares = [...counts]
    .map(([action, count]) => ({ action, percent: total ? (count / total) * 100 : 0 }))
    .sort((a, b) => rank(a.action) - rank(b.action));
  return { reach: (total / 1326) * 100, shares };
}

export { ACTION_ORDER };
