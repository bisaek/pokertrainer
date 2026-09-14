import { Action } from "./range.svelte";
import type { ParsedHand, PreflopAction } from "./hand-history-888";
import { rangeUrl, type RangeInfo } from "./manifest";

export type Verdict = "good" | "mixed" | "mistake" | "outside" | "uncovered";

// A chart file from public/ranges: the most frequent action and the measured frequencies per hand.
export type ChartFile = {
  name: string;
  range: (Action | null)[];
  frequencies?: (Record<string, number> | null)[];
};

export type ReviewedDecision = {
  // Game number plus decision number, so importing a file twice doesn't duplicate decisions.
  key: string;
  handId: string;
  date: string;
  stakes: string;
  tournament: string | null;
  cards: string;
  hand: string;
  handIndex: number;
  position: string;
  situation: string;
  // Situation type ("vs RFI", "vs 3-bet", ...) and opponent position, also kept for
  // decisions without a chart so they can be filtered.
  spotType?: string | null;
  opponent?: string | null;
  effectiveBB: number;
  heroAction: Action;
  verdict: Verdict;
  reason?: string;
  chart?: { url: string; name: string; stack: number; notes: string[] };
  // The action as graded, e.g. a shove counts as a raise on charts without a separate shove.
  gradedAction?: Action;
  chartAction?: Action | null;
  frequencies?: Record<string, number> | null;
};

// An action the chart takes at least this often is a less common choice, not a mistake.
const MIXED_THRESHOLD = 0.15;
// Charts for stacks farther than this factor from the effective stack aren't used.
const MAX_STACK_RATIO = 2.5;

const RANKS = "AKQJT98765432";
const NAMES_8 = ["BTN", "CO", "HJ", "LJ", "UTG+1", "UTG"];
const NAMES_9 = ["BTN", "CO", "HJ", "LJ", "UTG+2", "UTG+1", "UTG"];
// Charts to use when a position has none of its own, like MP in the 9-handed charts.
const ALIASES: Record<string, string[]> = {
  "UTG+2": ["UTG+1", "UTG"],
  "UTG+1": ["UTG"],
  LJ: ["MP"],
  HJ: ["MP"],
};

// "SB", "BB", or the number of seats before the button (0 = BTN, 1 = CO, ...).
// Counting back from the button keeps the players left to act the same at any table size,
// so a 6-max UTG uses the 8-handed LJ chart.
type Seat = "SB" | "BB" | number;

type Spot = { type: string; opponentSeat: Seat | null };

type FoundDecision = {
  number: number;
  heroSeat: Seat;
  spot: Spot | null;
  reason?: string;
  heroAction: Action;
  effectiveBB: number;
};

export function handFromCards([first, second]: [string, string]) {
  const a = RANKS.indexOf(first[0]);
  const b = RANKS.indexOf(second[0]);
  if (a === -1 || b === -1) throw new Error(`Unknown cards ${first} ${second}`);
  const high = Math.min(a, b);
  const low = Math.max(a, b);
  if (high === low) return { hand: RANKS[high] + RANKS[low], index: high * 13 + high };
  if (first[1] === second[1]) return { hand: `${RANKS[high]}${RANKS[low]}s`, index: high * 13 + low };
  return { hand: `${RANKS[high]}${RANKS[low]}o`, index: low * 13 + high };
}

function positionName(seat: Seat, nineHanded: boolean) {
  if (seat === "SB" || seat === "BB") return { name: seat, earlierThanCharted: false };
  const names = nineHanded ? NAMES_9 : NAMES_8;
  return seat < names.length
    ? { name: names[seat], earlierThanCharted: false }
    : { name: names[names.length - 1], earlierThanCharted: true };
}

function seatsOf(hand: ParsedHand): Map<string, Seat> {
  const inHand = new Set(hand.preflop.map((action) => action.player));
  if (hand.hero) inHand.add(hand.hero);
  const posted = (post: string) =>
    hand.preflop.find((action) => action.kind === "post" && action.post === post)?.player;
  const smallBlind = posted("small blind");
  const bigBlind = posted("big blind");

  const bySeat = hand.players.filter((p) => inHand.has(p.name)).sort((a, b) => a.seat - b.seat);
  // Clockwise from the first seat after the button, so the button comes last.
  const start = bySeat.findIndex((p) => p.seat > hand.buttonSeat);
  const clockwise = start <= 0 ? bySeat : [...bySeat.slice(start), ...bySeat.slice(0, start)];

  const seats = new Map<string, Seat>();
  clockwise
    .filter((p) => p.name !== smallBlind && p.name !== bigBlind)
    .reverse()
    .forEach((p, index) => seats.set(p.name, index));
  if (smallBlind) seats.set(smallBlind, "SB");
  if (bigBlind) seats.set(bigBlind, "BB");
  return seats;
}

function classify(action: PreflopAction, heroAllIn: boolean): Action {
  if (action.kind === "fold") return Action.Fold;
  if (action.kind === "check" || action.kind === "call") return Action.Call;
  return heroAllIn ? Action.AllIn : Action.Raise;
}

// Walks the preflop action and describes the spot at each of the hero's decisions.
function findDecisions(hand: ParsedHand): FoundDecision[] {
  const hero = hand.hero!;
  const seats = seatsOf(hand);
  const stacks = new Map(hand.players.map((p) => [p.name, p.stack]));
  const committed = new Map<string, number>();
  const folded = new Set<string>();
  const raisers: string[] = [];
  const raiseWasAllIn: boolean[] = [];
  const limpers: string[] = [];
  const callers: string[] = [];
  const decisions: FoundDecision[] = [];

  const put = (player: string, amount: number) =>
    committed.set(player, (committed.get(player) ?? 0) + amount);
  const isAllIn = (player: string) =>
    (committed.get(player) ?? 0) >= (stacks.get(player) ?? Infinity) - hand.bigBlind / 1000;

  function describeSpot(): { spot: Spot | null; reason?: string } {
    const heroSeat = seats.get(hero);
    const otherLimpers = limpers.filter((p) => p !== hero);
    if (raisers.length === 0) {
      if (otherLimpers.length === 0) return { spot: { type: "RFI", opponentSeat: null } };
      if (otherLimpers.length === 1 && heroSeat === "BB" && seats.get(otherLimpers[0]) === "SB") {
        return { spot: { type: "vs limp", opponentSeat: "SB" } };
      }
      return { spot: null, reason: "Limped pot" };
    }
    if (limpers.length > 0) return { spot: null, reason: "Someone limped before the raise" };
    const villain = raisers.find((p) => p !== hero);
    if (!villain || raisers[raisers.length - 1] === hero) return { spot: null, reason: "Multiway pot" };
    if (raisers.some((p) => p !== hero && p !== villain)) {
      return { spot: null, reason: "More than one opponent raised" };
    }
    if (callers.some((p) => p !== hero && p !== villain)) return { spot: null, reason: "Multiway pot" };
    const raises = raisers.length;
    if (raises > 5) return { spot: null, reason: "No charts past a 6-bet" };
    const shove = raiseWasAllIn[raises - 1];
    const type =
      raises === 1 ? (shove ? "vs all-in" : "vs RFI") : `vs ${raises + 1}-bet${shove ? " all-in" : ""}`;
    return { spot: { type, opponentSeat: seats.get(villain) ?? null } };
  }

  for (const action of hand.preflop) {
    if (action.kind === "post") {
      put(action.player, action.amount);
      continue;
    }

    let found: FoundDecision | null = null;
    if (action.player === hero) {
      const others = [...seats.keys()].filter((p) => p !== hero && !folded.has(p));
      const biggestOther = Math.max(0, ...others.map((p) => stacks.get(p) ?? 0));
      found = {
        number: decisions.length + 1,
        heroSeat: seats.get(hero) ?? 0,
        ...describeSpot(),
        heroAction: Action.Fold,
        effectiveBB: Math.min(stacks.get(hero) ?? 0, biggestOther) / hand.bigBlind,
      };
    }

    if (action.kind === "fold") {
      folded.add(action.player);
    } else if (action.kind === "call") {
      put(action.player, action.amount);
      (raisers.length === 0 ? limpers : callers).push(action.player);
    } else if (action.kind === "raise" || action.kind === "bet") {
      put(action.player, action.amount);
      raisers.push(action.player);
      raiseWasAllIn.push(isAllIn(action.player));
    }

    if (found) {
      found.heroAction = classify(action, isAllIn(hero));
      decisions.push(found);
    }
  }
  return decisions;
}

// "vs RFI" <-> "vs all-in", "vs 3-bet" <-> "vs 3-bet all-in".
function alternateType(type: string) {
  if (type === "vs RFI") return "vs all-in";
  if (type === "vs all-in") return "vs RFI";
  return type.endsWith(" all-in") ? type.slice(0, -" all-in".length) : `${type} all-in`;
}

function chooseChart(game: string, spot: Spot, heroSeat: Seat, effectiveBB: number, manifest: RangeInfo[]) {
  const distance = (stack: number) => Math.abs(Math.log(stack / effectiveBB));
  const stacks = [...new Set(manifest.filter((r) => r.game === game).map((r) => r.stack))]
    .filter((stack) => distance(stack) <= Math.log(MAX_STACK_RATIO))
    .sort((a, b) => distance(a) - distance(b));

  for (const stack of stacks) {
    const atStack = manifest.filter((r) => r.game === game && r.stack === stack);
    const nineHanded = atStack.some((r) => r.position === "UTG+2" || r.opponent === "UTG+2");
    const hero = positionName(heroSeat, nineHanded);
    const opponent = spot.opponentSeat === null ? null : positionName(spot.opponentSeat, nineHanded);
    const heroNames = [hero.name, ...(ALIASES[hero.name] ?? [])];
    const opponentNames = opponent ? [opponent.name, ...(ALIASES[opponent.name] ?? [])] : [null];

    for (const type of [spot.type, alternateType(spot.type)]) {
      for (const heroName of heroNames) {
        for (const opponentName of opponentNames) {
          const info = atStack.find(
            (r) => r.type === type && r.position === heroName && r.opponent === opponentName
          );
          if (!info) continue;

          const notes: string[] = [];
          if (distance(stack) > Math.log(1.25)) {
            notes.push(`${Math.round(effectiveBB)}bb effective, graded with the ${stack}bb chart.`);
          }
          if (hero.earlierThanCharted) notes.push(`Earlier than any charted seat, graded as ${heroName}.`);
          if (heroName !== hero.name) notes.push(`No ${hero.name} chart, graded as ${heroName}.`);
          if (opponent?.earlierThanCharted) notes.push(`Opponent earlier than any charted seat, graded as ${opponentName}.`);
          if (opponent && opponentName !== opponent.name) {
            notes.push(`No chart against ${opponent.name}, graded against ${opponentName}.`);
          }
          if (type !== spot.type) {
            notes.push(
              spot.type.includes("all-in")
                ? "No chart for facing a shove here, graded with the regular chart."
                : "Only a chart for facing a shove exists here."
            );
          }
          return { info, notes, heroName, opponentName };
        }
      }
    }
  }
  return null;
}

function situationLabel(type: string, hero: string, opponent: string | null) {
  if (type === "RFI") return `${hero}, folded to you`;
  if (type === "vs RFI") return `${hero} vs ${opponent} open`;
  if (type === "vs all-in") return `${hero} vs ${opponent} open shove`;
  if (type === "vs limp") return `${hero} vs ${opponent} limp`;
  const [, level, shove] = type.match(/^vs (\d-bet)( all-in)?$/) ?? [];
  return `${hero} vs ${opponent} ${level}${shove ? " shove" : ""}`;
}

export function grade(chart: ChartFile, handIndex: number, heroAction: Action) {
  const chartAction = chart.range[handIndex];
  if (chartAction === null) {
    return { verdict: "outside" as Verdict, chartAction, frequencies: null, gradedAction: heroAction };
  }
  const frequencies = chart.frequencies?.[handIndex] ?? { [chartAction]: 1 };
  let gradedAction = heroAction;
  if (gradedAction === Action.AllIn && !(Action.AllIn in frequencies)) gradedAction = Action.Raise;
  const frequency = frequencies[gradedAction] ?? 0;
  const verdict: Verdict =
    gradedAction === chartAction || frequency >= 0.5
      ? "good"
      : frequency >= MIXED_THRESHOLD
        ? "mixed"
        : "mistake";
  return { verdict, chartAction, frequencies, gradedAction };
}

// Reviews every preflop decision of the hero (the player dealt cards) in the given hands.
export async function reviewHands(
  hands: ParsedHand[],
  manifest: RangeInfo[],
  loadChart: (url: string) => Promise<ChartFile>
): Promise<ReviewedDecision[]> {
  const reviewed: ReviewedDecision[] = [];
  for (const hand of hands) {
    if (!hand.hero || !hand.heroCards) continue;
    const { hand: handLabel, index } = handFromCards(hand.heroCards);
    const game = hand.tournament ? "mtt" : "cash";

    for (const found of findDecisions(hand)) {
      const heroName = positionName(found.heroSeat, false).name;
      const base = {
        key: `${hand.id}-${found.number}`,
        handId: hand.id,
        date: hand.date,
        stakes: hand.stakes,
        tournament: hand.tournament,
        cards: hand.heroCards.join(" "),
        hand: handLabel,
        handIndex: index,
        effectiveBB: Math.round(found.effectiveBB * 10) / 10,
        heroAction: found.heroAction,
      };

      if (!found.spot) {
        reviewed.push({
          ...base,
          position: heroName,
          situation: `${heroName}, ${found.reason!.toLowerCase()}`,
          spotType: null,
          opponent: null,
          verdict: "uncovered",
          reason: found.reason,
        });
        continue;
      }

      const opponentName =
        found.spot.opponentSeat === null ? null : positionName(found.spot.opponentSeat, false).name;
      const choice = chooseChart(game, found.spot, found.heroSeat, found.effectiveBB, manifest);
      if (!choice) {
        reviewed.push({
          ...base,
          position: heroName,
          situation: situationLabel(found.spot.type, heroName, opponentName),
          spotType: found.spot.type,
          opponent: opponentName,
          verdict: "uncovered",
          reason: `No ${game === "mtt" ? "tournament" : "cash"} chart for this spot near ${Math.round(found.effectiveBB)}bb.`,
        });
        continue;
      }

      const url = rangeUrl(choice.info);
      const chart = await loadChart(url);
      reviewed.push({
        ...base,
        position: choice.heroName,
        situation: situationLabel(found.spot.type, choice.heroName, choice.opponentName),
        spotType: choice.info.type,
        opponent: choice.info.opponent,
        chart: { url, name: chart.name, stack: choice.info.stack, notes: choice.notes },
        ...grade(chart, index, found.heroAction),
      });
    }
  }
  return reviewed;
}
