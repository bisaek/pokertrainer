// Blackjack basic strategy for a shoe of 4 to 8 decks, with doubling on any
// two cards and after a split. The dealer either stands or hits on soft 17,
// and late surrender may or may not be offered.

export enum BjAction {
  Hit = "Hit",
  Stand = "Stand",
  Double = "Double",
  Split = "Split",
  Surrender = "Surrender",
}

export type BjRules = {
  // The dealer hits a soft 17 (H17) instead of standing on it (S17).
  hitSoft17: boolean;
  // Late surrender: give up half the bet after the dealer checks for blackjack.
  surrender: boolean;
};

export type HandKind = "hard" | "soft" | "pair";

// The dealer's upcards, as the chart's columns. Any ten-value card is a T.
export const UPCARDS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "A"] as const;
export type Upcard = (typeof UPCARDS)[number];

// A row of a chart: the hands it stands for, and the play against each upcard.
// The codes keep the fallbacks the published charts use, so the rules can
// pick between them: H hit, S stand, D double, P split, X double or else
// stand, R surrender or else hit, U surrender or else stand, Q surrender or
// else split. With two cards in hand a double is always allowed, so X is a
// double here; it differs from D only in what the chart says after a hit.
type Row = { key: string; label: string; s17: string; h17?: string };

export const CHARTS: Record<HandKind, Row[]> = {
  hard: [
    { key: "8", label: "5–8", s17: "HHHHHHHHHH" },
    { key: "9", label: "9", s17: "HDDDDHHHHH" },
    { key: "10", label: "10", s17: "DDDDDDDDHH" },
    { key: "11", label: "11", s17: "DDDDDDDDDH", h17: "DDDDDDDDDD" },
    { key: "12", label: "12", s17: "HHSSSHHHHH" },
    { key: "13", label: "13", s17: "SSSSSHHHHH" },
    { key: "14", label: "14", s17: "SSSSSHHHHH" },
    { key: "15", label: "15", s17: "SSSSSHHHRH", h17: "SSSSSHHHRR" },
    { key: "16", label: "16", s17: "SSSSSHHRRR" },
    { key: "17", label: "17", s17: "SSSSSSSSSS", h17: "SSSSSSSSSU" },
    { key: "18", label: "18+", s17: "SSSSSSSSSS" },
  ],
  soft: [
    { key: "2", label: "A,2", s17: "HHHDDHHHHH" },
    { key: "3", label: "A,3", s17: "HHHDDHHHHH" },
    { key: "4", label: "A,4", s17: "HHDDDHHHHH" },
    { key: "5", label: "A,5", s17: "HHDDDHHHHH" },
    { key: "6", label: "A,6", s17: "HDDDDHHHHH" },
    { key: "7", label: "A,7", s17: "SXXXXSSHHH", h17: "XXXXXSSHHH" },
    { key: "8", label: "A,8", s17: "SSSSSSSSSS", h17: "SSSSXSSSSS" },
    { key: "9", label: "A,9", s17: "SSSSSSSSSS" },
  ],
  pair: [
    { key: "2", label: "2,2", s17: "PPPPPPHHHH" },
    { key: "3", label: "3,3", s17: "PPPPPPHHHH" },
    { key: "4", label: "4,4", s17: "HHHPPHHHHH" },
    { key: "5", label: "5,5", s17: "DDDDDDDDHH" },
    { key: "6", label: "6,6", s17: "PPPPPHHHHH" },
    { key: "7", label: "7,7", s17: "PPPPPPHHHH" },
    { key: "8", label: "8,8", s17: "PPPPPPPPPP", h17: "PPPPPPPPPQ" },
    { key: "9", label: "9,9", s17: "PPPPPSPPSS" },
    { key: "T", label: "T,T", s17: "SSSSSSSSSS" },
    { key: "A", label: "A,A", s17: "PPPPPPPPPP" },
  ],
};

export const KIND_NAMES: Record<HandKind, string> = {
  hard: "Hard totals",
  soft: "Soft totals",
  pair: "Pairs",
};

function resolve(code: string, rules: BjRules): BjAction {
  switch (code) {
    case "H":
      return BjAction.Hit;
    case "S":
      return BjAction.Stand;
    case "D":
    case "X":
      return BjAction.Double;
    case "P":
      return BjAction.Split;
    case "R":
      return rules.surrender ? BjAction.Surrender : BjAction.Hit;
    case "U":
      return rules.surrender ? BjAction.Surrender : BjAction.Stand;
    case "Q":
      return rules.surrender ? BjAction.Surrender : BjAction.Split;
  }
  throw new Error(`Unknown strategy code ${code}`);
}

// The right play for a chart cell under the rules.
export function chartAction(
  kind: HandKind,
  row: number,
  upcard: number,
  rules: BjRules
): BjAction {
  const { s17, h17 } = CHARTS[kind][row];
  return resolve((rules.hitSoft17 ? h17 ?? s17 : s17)[upcard], rules);
}

// A dealt question: the player's two cards, the dealer's upcard and the cell
// of the chart they fall in.
export type BjHand = {
  kind: HandKind;
  row: number;
  upcard: number;
  // Cards as rank + suit, the way the card images are named ("TS", "AH").
  player: [string, string];
  dealer: string;
};

const SUITS = ["C", "D", "H", "S"];
const TENS = ["T", "J", "Q", "K"];

const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

// A card of the rank, with a ten-value rank drawn as any of 10, J, Q or K.
function card(rank: string): string {
  return (rank === "T" ? pick(TENS) : rank) + pick(SUITS);
}

const value = (rank: string) => (rank === "A" ? 11 : rank === "T" ? 10 : Number(rank));

// Two different ranks without an ace that add up to the hard total.
function hardRanks(total: number): [string, string] {
  const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "T"];
  const pairs: [string, string][] = [];
  for (const a of ranks)
    for (const b of ranks)
      if (a !== b && value(a) + value(b) === total) pairs.push([a, b]);
  return pick(pairs);
}

// The hard totals each hard row stands for.
const HARD_TOTALS: Record<string, number[]> = {
  "8": [5, 6, 7, 8],
  "18": [18, 19],
};

function deal(kind: HandKind, row: number, upcard: number): BjHand {
  const key = CHARTS[kind][row].key;
  let ranks: [string, string];
  if (kind === "pair") ranks = [key, key];
  else if (kind === "soft") ranks = ["A", key];
  else ranks = hardRanks(pick(HARD_TOTALS[key] ?? [Number(key)]));
  if (Math.random() < 0.5) ranks.reverse();
  return {
    kind,
    row,
    upcard,
    player: [card(ranks[0]), card(ranks[1])],
    dealer: card(UPCARDS[upcard]),
  };
}

// Every cell of the charts of these kinds, each one as likely as the next,
// so the rare hands come up as often as the common ones.
export function dealHand(kinds: HandKind[], avoid?: BjHand): BjHand {
  const cells: [HandKind, number, number][] = [];
  for (const kind of kinds)
    CHARTS[kind].forEach((_, row) =>
      UPCARDS.forEach((_, upcard) => {
        if (avoid && avoid.kind === kind && avoid.row === row && avoid.upcard === upcard) return;
        cells.push([kind, row, upcard]);
      })
    );
  const [kind, row, upcard] = pick(cells);
  return deal(kind, row, upcard);
}

// A fresh deal of the same chart cell, so a missed hand comes back with
// other cards.
export function redeal(hand: BjHand): BjHand {
  return deal(hand.kind, hand.row, hand.upcard);
}

// The player's total as a blackjack table would call it: "Soft 18", "Hard 12".
export function handTotal(hand: BjHand): string {
  const ranks = hand.player.map((c) => c[0]);
  const total = ranks.reduce((sum, rank) => sum + (TENS.includes(rank) ? 10 : value(rank)), 0);
  if (ranks[0] === "A" && ranks[1] === "A") return "Soft 12";
  if (ranks.includes("A")) return `Soft ${total}`;
  return `Hard ${total}`;
}

export const ACTION_LETTER: Record<BjAction, string> = {
  [BjAction.Hit]: "H",
  [BjAction.Stand]: "S",
  [BjAction.Double]: "D",
  [BjAction.Split]: "P",
  [BjAction.Surrender]: "R",
};

export const ACTION_CLASS: Record<BjAction, string> = {
  [BjAction.Hit]: "bj-hit",
  [BjAction.Stand]: "bj-stand",
  [BjAction.Double]: "bj-double",
  [BjAction.Split]: "bj-split",
  [BjAction.Surrender]: "bj-surrender",
};
