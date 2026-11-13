import type { Spot } from "./spot";

// GTO Wizard's seats in the order they act preflop, at the 8-max tables used
// below. A 9-max chart's UTG+2 sits where 8-max has UTG+1.
const seats = ["UTG", "UTG+1", "LJ", "HJ", "CO", "BTN", "SB", "BB"];
const seatFor: Record<string, string> = { "UTG+2": "UTG+1" };

// The single size solutions, which a free account can browse, closest to each
// game: 8-max chipEV tournaments with antes and 8-max cash without rake. Each
// stack lists every seat's open from UTG to SB, read off GTO Wizard; a link
// has to name a size the solution has, so stacks without one get no link.
const formats: Record<
  string,
  {
    gametype: string;
    ante: number;
    // Tournaments also come with uneven stacks, so the stacks are named;
    // naming them for a cash game makes GTO Wizard drop the solution.
    symmetric: boolean;
    opens: Record<number, number[]>;
  }
> = {
  mtt: {
    gametype: "MTTGeneral_8m",
    ante: 0.125,
    symmetric: true,
    opens: {
      12: [2, 2, 2, 2, 2, 2, 2],
      20: [2, 2, 2, 2, 2, 2, 3],
      25: [2, 2, 2, 2, 2, 2, 3],
      30: [2, 2, 2, 2, 2, 2, 3],
      50: [2, 2, 2, 2, 2.1, 2.1, 3.5],
      80: [2, 2, 2.1, 2.1, 2.2, 2.3, 3.5],
    },
  },
  cash: {
    gametype: "Cash8mLiveGeneral_8mcEVR25",
    ante: 0,
    symmetric: false,
    opens: {
      100: [2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 3],
      200: [2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 3],
    },
  },
};

// A link to this spot's solution on GTO Wizard, played up to the hero's
// decision. Only the open's size is known here, so a spot with a 3-bet or
// more stops at the first raise after the open, which is clicked there.
export function gtoWizardUrl(spot: Spot): string | null {
  const format = spot.game === null ? undefined : formats[spot.game];
  const opens = spot.stack === null ? undefined : format?.opens[spot.stack];
  if (!format || !opens || spot.stack === null) return null;

  const indexOf = (seat: string) => seats.indexOf(seatFor[seat] ?? seat);
  const hero = indexOf(spot.hero);
  const villain = spot.villain === null ? -1 : indexOf(spot.villain);
  if (hero === -1 || (spot.villain !== null && villain === -1)) return null;

  // Everyone folds to the first player in, who opens; then everyone folds to
  // the other player.
  const first = villain === -1 ? hero : Math.min(hero, villain);
  const actions: string[] = Array(first).fill("F");
  if (villain !== -1) {
    const second = Math.max(hero, villain);
    const open =
      first === villain && spot.type === "vs limp"
        ? "C"
        : first === villain && spot.type === "vs all-in"
          ? "RAI"
          : `R${opens[first]}`;
    actions.push(open, ...Array(second - first - 1).fill("F"));
    // The villain shoved over the hero's open.
    if (first === hero && spot.type === "vs 3-bet all-in") actions.push("RAI");
  }

  const depth = spot.stack + format.ante;
  const params = new URLSearchParams({
    gametype: format.gametype,
    depth: String(depth),
    soltab: "strategy",
    preflop_actions: actions.join("-"),
    // The decision shown: the one after the last action.
    history_spot: String(actions.length),
  });
  if (format.symmetric) params.set("stacks", Array(seats.length).fill(depth).join("-"));
  return `https://app.gtowizard.com/solutions?${params}`;
}
