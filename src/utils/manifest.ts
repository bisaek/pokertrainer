// An entry of /ranges/index.json (see src/pages/ranges/index.json.ts).
export type RangeInfo = {
  game: string;
  stack: number;
  situation: string;
  type: string;
  opponent: string | null;
  position: string;
};

export const positionOrder = [
  "UTG",
  "UTG+1",
  "UTG+2",
  "LJ",
  "MP",
  "HJ",
  "CO",
  "BTN",
  "SB",
  "BB",
];

export const typeOrder = [
  "RFI",
  "vs RFI",
  "vs all-in",
  "vs limp",
  "vs 3-bet",
  "vs 3-bet all-in",
  "vs 4-bet",
  "vs 4-bet all-in",
  "vs 5-bet",
  "vs 5-bet all-in",
  "vs 6-bet",
  "vs 6-bet all-in",
];

export async function fetchManifest(): Promise<RangeInfo[]> {
  const response = await fetch("/ranges/index.json");
  return response.json();
}

// Whether this host wants "+" in a path escaped. Vercel answers 404 for a folder
// like "vs UTG+1" but serves "vs UTG%2B1"; the dev server does the opposite.
let escapePlus = false;

// Loads a chart file, trying both spellings of "+" and remembering which one this
// host accepts, so only the first chart pays for a wrong guess.
export async function fetchChart(url: string): Promise<unknown> {
  const escaped = url.replaceAll("+", "%2B");
  const response = await fetch(escapePlus ? escaped : url);
  if (response.ok) return response.json();
  if (url.includes("+")) {
    const retry = await fetch(escapePlus ? url : escaped);
    if (retry.ok) {
      escapePlus = !escapePlus;
      return retry.json();
    }
  }
  throw new Error(`Couldn't load ${decodeURI(url)} (${response.status})`);
}

export function rangeUrl(range: RangeInfo): string {
  // encodeURI keeps "+" (as in UTG+1) literal; "%2B" isn't served.
  return encodeURI(
    `/ranges/${range.game}/${range.stack}/${range.situation}/${range.position}.json`
  );
}

// Splits a situation folder name into what the hero faces and from whom:
// "RFI" -> RFI, "vs UTG" -> vs RFI from UTG, "vs LJ 3-bet" -> vs 3-bet from LJ,
// "vs BTN all-in" -> vs all-in (open shove) from BTN.
export function parseSituation(situation: string): {
  type: string;
  opponent: string | null;
} {
  if (situation === "RFI") return { type: "RFI", opponent: null };
  const match = situation.match(
    /^vs (\S+)(?: (limp|all-in|[3-6]-bet(?: all-in)?))?$/
  );
  if (!match) return { type: situation, opponent: null };
  return { type: match[2] ? `vs ${match[2]}` : "vs RFI", opponent: match[1] };
}

// Reads a range's game, stack, situation and position back from its URL.
export function rangeInfoFromUrl(url: string): RangeInfo | null {
  const match = decodeURI(url).match(
    /^\/ranges\/([^/]+)\/(\d+)\/([^/]+)\/([^/]+)\.json$/
  );
  if (!match) return null;
  const [, game, stack, situation, position] = match;
  return { game, stack: Number(stack), situation, ...parseSituation(situation), position };
}

// What the range filter narrows by. Ranges have every field; a reviewed decision
// without a chart may not know its stack or situation.
export type FilterItem = {
  game: string;
  stack: number | null;
  position: string;
  type: string | null;
  opponent: string | null;
};

export type RangeFilterValue = {
  game: string;
  stacks: number[];
  positions: string[];
  types: string[];
  opponents: string[];
};

export function emptyFilter(game: string): RangeFilterValue {
  return { game, stacks: [], positions: [], types: [], opponents: [] };
}

// With `emptyMeansAll`, a row with nothing selected lets everything through (a filter);
// without it, a row with nothing selected lets nothing through (picking ranges to load).
export function matchesFilter(
  item: FilterItem,
  filter: RangeFilterValue,
  emptyMeansAll: boolean
) {
  const allows = <T>(selected: T[], value: T | null) =>
    selected.length === 0 ? emptyMeansAll : value !== null && selected.includes(value);
  return (
    item.game === filter.game &&
    allows(filter.stacks, item.stack) &&
    allows(filter.positions, item.position) &&
    allows(filter.types, item.type) &&
    (item.opponent === null || allows(filter.opponents, item.opponent))
  );
}
