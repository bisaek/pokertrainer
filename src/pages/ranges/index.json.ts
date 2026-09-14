import type { APIRoute } from "astro";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

// Splits a situation folder name into what the hero faces and from whom:
// "RFI" -> RFI, "vs UTG" -> vs RFI from UTG, "vs LJ 3-bet" -> vs 3-bet from LJ,
// "vs BTN all-in" -> vs all-in (open shove) from BTN.
function parseSituation(situation: string) {
  if (situation === "RFI") return { type: "RFI", opponent: null };
  const match = situation.match(
    /^vs (\S+)(?: (limp|all-in|[3-6]-bet(?: all-in)?))?$/
  );
  if (!match) return { type: situation, opponent: null };
  return { type: match[2] ? `vs ${match[2]}` : "vs RFI", opponent: match[1] };
}

// Lists every range in public/ranges/<game>/<stack>/<situation>/<position>.json
// so the range selecter only offers options that have data.
export const GET: APIRoute = async () => {
  const root = join(process.cwd(), "public", "ranges");
  const ranges = [];

  for (const game of await readdir(root)) {
    for (const stack of await readdir(join(root, game))) {
      for (const situation of await readdir(join(root, game, stack))) {
        for (const file of await readdir(join(root, game, stack, situation))) {
          if (!file.endsWith(".json")) continue;
          ranges.push({
            game,
            stack: Number(stack),
            situation,
            ...parseSituation(situation),
            position: file.slice(0, -".json".length),
          });
        }
      }
    }
  }

  return new Response(JSON.stringify(ranges), {
    headers: { "Content-Type": "application/json" },
  });
};
