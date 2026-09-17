import { positionOrder, type RangeInfo } from "./manifest";
import { Action } from "./range.svelte";

// The table picture around a chart: who sits where, what has happened before it
// is the hero's turn, and what the hero's options cost. The bet sizes here are
// ordinary examples so the table looks like a real hand; the answer to a hand
// always comes from the chart, never from these numbers.

export type Seat = {
  position: string;
  hero: boolean;
  // Already out of the hand when the action reaches the hero.
  folded: boolean;
  // Still to act behind the hero.
  waiting: boolean;
  // What the seat has done, e.g. "Folds", "Raises to 2.5bb", "Big blind".
  action: string | null;
  // Chips in front of the seat, in big blinds.
  chips: number;
  // Where the seat sits on the felt, in percent of its width and height.
  x: number;
  y: number;
};

export type Situation = {
  seats: Seat[];
  hero: Seat;
  opponent: Seat | null;
  stack: number;
  ante: boolean;
  // Everything in the middle plus the bets in front of the seats.
  pot: number;
  // What the hero must add to continue; 0 when checking is free.
  toCall: number;
  // What a raise makes it.
  raiseTo: number;
  headline: string;
};

const SMALL_BLIND = 0.5;
const BIG_BLIND = 1;
const ANTE = 1;

const round = (bb: number) => Math.round(bb * 10) / 10;
const bb = (amount: number) => `${round(amount)}bb`;

// A typical first raise at this stack depth.
function openTo(stack: number): number {
  if (stack >= 100) return 2.5;
  if (stack >= 40) return 2.3;
  if (stack >= 25) return 2.2;
  return 2;
}

// Level 2 is the open, 3 the 3-bet, and so on; each raise is about 2.5 times the
// last one, and anything close to the stack is just a shove.
function betAt(level: number, stack: number): number {
  let bet = openTo(stack);
  for (let raise = 3; raise <= level; raise++) bet = round(bet * 2.5);
  return bet >= stack * 0.8 ? stack : round(bet);
}

// What the hero is facing, read from the chart's situation: the level of the last
// bet and whether it was all in. Null when the hero opens the pot.
function facing(type: string): { level: number; allIn: boolean } | null {
  if (type === "RFI") return null;
  if (type === "vs limp") return { level: 1, allIn: false };
  if (type === "vs RFI") return { level: 2, allIn: false };
  if (type === "vs all-in") return { level: 2, allIn: true };
  const match = type.match(/^vs ([3-6])-bet( all-in)?$/);
  if (!match) return { level: 2, allIn: type.endsWith("all-in") };
  return { level: Number(match[1]), allIn: Boolean(match[2]) };
}

function blind(position: string): number {
  if (position === "SB") return SMALL_BLIND;
  if (position === "BB") return BIG_BLIND;
  return 0;
}

// "raises"/"3-bets" for a seat label, "raise"/"3-bet" when the hero is the one doing it.
function raiseName(level: number): string {
  return level === 2 ? "raises" : `${level}-bets`;
}

function myRaiseName(level: number): string {
  return level === 2 ? "raise" : `${level}-bet`;
}

const capitalize = (text: string) => text[0].toUpperCase() + text.slice(1);

// Seats sit around an oval with the hero at the bottom; the seats that act after
// the hero run up the left side, the ones that already acted down the right.
function seatAt(index: number, heroIndex: number, count: number) {
  const angle = Math.PI / 2 + ((index - heroIndex) * 2 * Math.PI) / count;
  // Kept inside the felt so the widest seat label still fits on a phone.
  return { x: 50 + 38 * Math.cos(angle), y: 50 + 38 * Math.sin(angle) };
}

export function buildSituation(info: RangeInfo, tablePositions: string[]): Situation {
  const positions = positionOrder.filter(
    (position) => tablePositions.includes(position) || position === info.position
  );
  const stack = info.stack;
  const ante = info.game !== "cash";
  const against = facing(info.type);

  // The hero's own bet, when the chart is about facing a raise of their raise.
  const heroBet = against && against.level >= 3 ? betAt(against.level - 1, stack) : 0;
  const opponentBet = against
    ? against.allIn
      ? stack
      : against.level === 1
        ? BIG_BLIND
        : betAt(against.level, stack)
    : 0;

  const heroIndex = positions.indexOf(info.position);
  const opponentIndex = info.opponent ? positions.indexOf(info.opponent) : -1;
  const lastToAct = Math.max(heroIndex, opponentIndex);

  const seats: Seat[] = positions.map((position, index) => {
    const hero = index === heroIndex;
    const isOpponent = index === opponentIndex;
    const folded = !hero && !isOpponent && index < lastToAct;
    const waiting = !hero && !isOpponent && index > lastToAct;

    let chips = blind(position);
    let action: string | null = folded ? "Folds" : null;
    if (folded) chips = 0;
    if (hero) {
      chips = Math.max(chips, heroBet);
      if (heroBet > 0) action = capitalize(`${raiseName(against!.level - 1)} to ${bb(heroBet)}`);
    }
    if (isOpponent && against) {
      chips = Math.max(chips, opponentBet);
      action = against.allIn
        ? `All in ${bb(opponentBet)}`
        : against.level === 1
          ? "Limps"
          : capitalize(`${raiseName(against.level)} to ${bb(opponentBet)}`);
    }
    if (waiting && blind(position) > 0) {
      action = position === "SB" ? "Small blind" : "Big blind";
    }

    return { position, hero, folded, waiting, action, chips, ...seatAt(index, heroIndex, positions.length) };
  });

  const hero = seats[heroIndex];
  const opponent = opponentIndex >= 0 ? seats[opponentIndex] : null;
  const committed = seats.reduce((total, seat) => total + seat.chips, 0);
  // Blinds from seats that folded are dead money in the middle.
  const dead = seats
    .filter((seat) => seat.folded)
    .reduce((total, seat) => total + blind(seat.position), 0);

  return {
    seats,
    hero,
    opponent,
    stack,
    ante,
    pot: round(committed + dead + (ante ? ANTE : 0)),
    toCall: round(Math.max(0, Math.max(opponentBet, BIG_BLIND) - hero.chips)),
    raiseTo: betAt((against?.level ?? 1) + 1, stack),
    headline: headlineFor(info, against, heroBet, opponentBet),
  };
}

function headlineFor(
  info: RangeInfo,
  against: { level: number; allIn: boolean } | null,
  heroBet: number,
  opponentBet: number
): string {
  if (!against) return "It folds to you.";
  const opponent = info.opponent ?? "An opponent";
  const mine = heroBet > 0 ? `You ${myRaiseName(against.level - 1)} to ${bb(heroBet)}. ` : "";
  if (against.level === 1) return `${mine}${opponent} limps.`;
  if (against.allIn) return `${mine}${opponent} moves all in for ${bb(opponentBet)}.`;
  return `${mine}${opponent} ${raiseName(against.level)} to ${bb(opponentBet)}.`;
}

// What an action costs the hero, for the buttons and the seat label.
export function actionLabel(action: Action, situation: Situation): string {
  switch (action) {
    case Action.Fold:
      return "Fold";
    case Action.Call:
      return situation.toCall === 0 ? "Check" : `Call ${bb(situation.toCall)}`;
    case Action.Raise:
      return `Raise to ${bb(situation.raiseTo)}`;
    case Action.AllIn:
      return `All in ${bb(situation.stack)}`;
  }
}

// The past tense of what the hero just did, for their seat.
export function heroActionLabel(action: Action, situation: Situation): string {
  switch (action) {
    case Action.Fold:
      return "Folds";
    case Action.Call:
      return situation.toCall === 0 ? "Checks" : `Calls ${bb(situation.toCall)}`;
    case Action.Raise:
      return `Raises to ${bb(situation.raiseTo)}`;
    case Action.AllIn:
      return `All in ${bb(situation.stack)}`;
  }
}
