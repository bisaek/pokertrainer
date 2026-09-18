import { rangeInfoFromUrl, type RangeInfo } from "./manifest";

// The situation a chart is for: who the hero is, what they face and from whom.
export type Spot = {
  game: string | null;
  stack: number | null;
  hero: string;
  // The player whose action the hero faces; nobody when it folded to the hero.
  villain: string | null;
  // "RFI", "vs RFI", "vs limp", "vs all-in", "vs 3-bet", "vs 3-bet all-in", ...
  type: string;
};

// Every seat of a full-ring table, in the order they act preflop.
export const seatOrder = ["UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN", "SB", "BB"];

// A chart can cover several seats ("LJ/HJ", "UTG+1/+2") or name a region
// ("MP" for the middle positions); the table shows the first of them.
function seatFor(position: string): string {
  const first = position.split("/")[0];
  return first === "MP" ? "LJ" : first;
}

export function spotFromInfo(info: RangeInfo): Spot {
  return {
    game: info.game,
    stack: info.stack,
    hero: seatFor(info.position),
    villain: info.opponent === null ? null : seatFor(info.opponent),
    type: info.type,
  };
}

export function spotFromUrl(url: string): Spot | null {
  const info = rangeInfoFromUrl(url);
  return info ? spotFromInfo(info) : null;
}

// Reads the spot from a chart's name, for charts without a URL such as
// imported files: "MTT 80bb SB vs UTG RFI", "Cash 100bb BB vs SB limp",
// "25bb RFI UTG", "25bb LJ/HJ vs UTG RFI".
export function spotFromName(name: string): Spot | null {
  const match = name
    .trim()
    .match(/^(?:(cash|mtt)\s+)?(?:(\d+)\s*bb\s+)?(.+)$/i);
  if (!match) return null;
  const [, game, stack, rest] = match;
  const base = {
    game: game ? game.toLowerCase() : null,
    stack: stack ? Number(stack) : null,
  };

  const open = rest.match(/^(?:RFI\s+(\S+)|(\S+)\s+RFI)$/i);
  if (open) {
    return { ...base, hero: seatFor(open[1] ?? open[2]), villain: null, type: "RFI" };
  }

  const faced = rest.match(
    /^(\S+)\s+vs\s+(\S+)\s+(RFI|limp|all-in|[3-6]-bet(?:\s+all-in)?)$/i
  );
  if (!faced) return null;
  const type = faced[3].toLowerCase();
  return {
    ...base,
    hero: seatFor(faced[1]),
    villain: seatFor(faced[2]),
    type: type === "rfi" ? "vs RFI" : `vs ${type}`,
  };
}

export type SeatAction = {
  label: string;
  // Matches the action color classes in global.css.
  kind: "raise" | "call" | "allin";
};

export type Seat = {
  position: string;
  role: "hero" | "villain" | "other";
  // Folded seats sit out; waiting seats still hold cards but haven't acted.
  status: "folded" | "waiting" | "acted";
  action: SeatAction | null;
  // Money in front of the seat: a posted blind or a bet.
  chips: boolean;
};

// The table right before the hero acts: who folded, who bet what.
export function seatsFor(spot: Spot): Seat[] {
  const positions = seatOrder.filter(
    (seat) => seat !== "UTG+2" || spot.hero === seat || spot.villain === seat
  );
  const heroIndex = positions.indexOf(spot.hero);
  const villainIndex = spot.villain === null ? -1 : positions.indexOf(spot.villain);

  const seats: Seat[] = positions.map((position) => ({
    position,
    role: position === spot.hero ? "hero" : position === spot.villain ? "villain" : "other",
    status: "waiting",
    action: null,
    chips: position === "SB" || position === "BB",
  }));

  const fold = (seat: Seat) => {
    seat.status = "folded";
    seat.chips = false;
  };
  const bet = (seat: Seat, action: SeatAction) => {
    seat.status = "acted";
    seat.action = action;
    seat.chips = true;
  };

  const hero = seats[heroIndex];
  const villain = villainIndex === -1 ? undefined : seats[villainIndex];
  if (!hero) return seats;

  const raised = spot.type.match(/^vs ([3-6])-bet( all-in)?$/);
  if (raised && villain) {
    // The pot has been raised back and forth between the hero and the villain,
    // so everyone else is out. An odd bet count means the hero opened.
    const bets = Number(raised[1]);
    const heroBets = bets - 1;
    for (const seat of seats) if (seat !== hero && seat !== villain) fold(seat);
    bet(hero, {
      label: heroBets === 2 ? "Raise" : `${heroBets}-bet`,
      kind: "raise",
    });
    bet(villain, raised[2] ? { label: "All in", kind: "allin" } : { label: `${bets}-bet`, kind: "raise" });
    return seats;
  }

  // Nobody before the hero has entered the pot, except a villain who did.
  for (const seat of seats.slice(0, heroIndex)) if (seat !== villain) fold(seat);
  if (villain) {
    if (spot.type === "vs limp") bet(villain, { label: "Limp", kind: "call" });
    else if (spot.type === "vs all-in") bet(villain, { label: "All in", kind: "allin" });
    else bet(villain, { label: "Raise", kind: "raise" });
  }
  return seats;
}
