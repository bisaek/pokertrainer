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

export function rangeUrl(range: RangeInfo): string {
  // encodeURI keeps "+" (as in UTG+1) literal; "%2B" isn't served.
  return encodeURI(
    `/ranges/${range.game}/${range.stack}/${range.situation}/${range.position}.json`
  );
}
