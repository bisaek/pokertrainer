// Hi-Lo card counting: low cards (2-6) leaving the shoe are good for the
// player, high cards (10-A) bad, so each card seen adds or takes one away.

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
const SUITS = ["C", "D", "H", "S"];

// A card as rank + suit, the way the card images are named ("TS", "AH").
export function hiLo(card: string): -1 | 0 | 1 {
  const rank = card[0];
  if ("23456".includes(rank)) return 1;
  if ("789".includes(rank)) return 0;
  return -1;
}

export function randomCard(): string {
  return (
    RANKS[Math.floor(Math.random() * RANKS.length)] + SUITS[Math.floor(Math.random() * SUITS.length)]
  );
}

// A shuffled shoe of whole decks. The cut card sits at the penetration: the
// share of the shoe dealt before it is reshuffled.
export class Shoe {
  cards: string[] = [];
  dealt = 0;

  constructor(
    public decks: number,
    public penetration = 0.75
  ) {
    this.shuffle();
  }

  shuffle() {
    this.cards = [];
    for (let d = 0; d < this.decks; d++)
      for (const rank of RANKS) for (const suit of SUITS) this.cards.push(rank + suit);
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
    this.dealt = 0;
  }

  // The cut card has come out: time to shuffle.
  get finished(): boolean {
    return this.dealt >= Math.floor(this.cards.length * this.penetration);
  }

  draw(): string {
    return this.cards[this.dealt++];
  }

  // The decks left to deal, as a player reads them off the discard tray: to
  // the nearest half deck, and never less than half a deck.
  get decksLeft(): number {
    const left = (this.cards.length - this.dealt) / 52;
    return Math.max(0.5, Math.round(left * 2) / 2);
  }
}

// The true count: the running count per deck left. Players drop the
// fraction, so any of rounding down, toward zero or to the nearest whole
// number is taken as right.
export function trueCount(running: number, decksLeft: number): number {
  return running / decksLeft;
}

export function trueCountAnswers(running: number, decksLeft: number): number[] {
  const exact = trueCount(running, decksLeft);
  return [...new Set([Math.floor(exact), Math.trunc(exact), Math.round(exact)])].map((n) =>
    Object.is(n, -0) ? 0 : n
  );
}
