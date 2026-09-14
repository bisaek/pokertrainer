import type { APIRoute } from "astro";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

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
