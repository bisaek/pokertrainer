import type { Spot } from "./spot";

// The GTO Wizard solutions a chart's game is closest to, and their seats in
// the order they act preflop. Tournaments are the 8-max solutions with antes;
// cash games are the 6-max ones, where the early seats share the first seat.
const formats: Record<
  string,
  { gametype: string; antes: boolean; seats: string[]; seatFor: Record<string, string> }
> = {
  mtt: {
    gametype: "MTTGeneral",
    antes: true,
    seats: ["UTG", "UTG+1", "LJ", "HJ", "CO", "BTN", "SB", "BB"],
    seatFor: { "UTG+2": "UTG+1" },
  },
  cash: {
    gametype: "Cash6m50zGeneral",
    antes: false,
    seats: ["UTG", "HJ", "CO", "BTN", "SB", "BB"],
    seatFor: { "UTG+1": "UTG", "UTG+2": "UTG", LJ: "UTG" },
  },
};

// A link to this spot's solution on GTO Wizard. The line folds round to the
// first player to put money in, so it opens on the hero's decision when the
// pot is unopened and on the first bet of the hand otherwise: GTO Wizard's
// bet sizes vary by solution, so the rest is clicked through there.
export function gtoWizardUrl(spot: Spot): string | null {
  const format = spot.game === null ? undefined : formats[spot.game];
  if (!format || spot.stack === null) return null;

  const indexOf = (seat: string) => format.seats.indexOf(format.seatFor[seat] ?? seat);
  const hero = indexOf(spot.hero);
  if (hero === -1) return null;
  const villain = spot.villain === null ? hero : indexOf(spot.villain);
  const folds = Math.min(hero, villain === -1 ? hero : villain);

  const params = new URLSearchParams({
    gametype: format.gametype,
    // Each player posts an eighth of a big blind as ante, which GTO Wizard
    // counts in the stack.
    depth: String(format.antes ? spot.stack + 0.125 : spot.stack),
    soltab: "strategy",
    preflop_actions: Array(folds).fill("F").join("-"),
  });
  return `https://app.gtowizard.com/solutions?${params}`;
}
