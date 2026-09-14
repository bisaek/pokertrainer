// Generates simplified (one action per hand) preflop range JSON files for the
// range trainer from standard range notation.
//
// Run with: node scripts/generate-ranges.mjs
//
// Notation: "TT+" (TT-AA), "A5s-A2s", "K9s+" (K9s-KQs), "AQo+" (AQo-AKo), "22-99", "AKo".
// Every hand not listed is a fold. A hand listed under two actions throws an error.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RANKS = "AKQJT98765432";
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "ranges");

// Same order as the Hand enum in src/utils/range.svelte.ts:
// row = first rank, column = second rank, suited above the diagonal, offsuit below.
const HANDS = [];
for (let row = 0; row < 13; row++) {
  for (let col = 0; col < 13; col++) {
    if (row === col) HANDS.push(RANKS[row] + RANKS[col]);
    else if (col > row) HANDS.push(RANKS[row] + RANKS[col] + "s");
    else HANDS.push(RANKS[col] + RANKS[row] + "o");
  }
}

function rankIndex(rank) {
  const index = RANKS.indexOf(rank);
  if (index === -1) throw new Error(`Unknown rank "${rank}"`);
  return index;
}

function expandToken(token) {
  token = token.trim();
  const hands = [];

  if (token.includes("-")) {
    const [from, to] = token.split("-");
    const isPair = from.length === 2;
    const k = isPair ? 0 : 1;
    const lo = Math.min(rankIndex(from[k]), rankIndex(to[k]));
    const hi = Math.max(rankIndex(from[k]), rankIndex(to[k]));
    if (!isPair && (from[0] !== to[0] || from[2] !== to[2])) {
      throw new Error(`Bad range "${token}"`);
    }
    for (let i = lo; i <= hi; i++) {
      hands.push(isPair ? RANKS[i] + RANKS[i] : from[0] + RANKS[i] + from[2]);
    }
  } else if (token.endsWith("+")) {
    const base = token.slice(0, -1);
    if (base.length === 2) {
      for (let i = 0; i <= rankIndex(base[0]); i++) hands.push(RANKS[i] + RANKS[i]);
    } else {
      for (let i = rankIndex(base[0]) + 1; i <= rankIndex(base[1]); i++) {
        hands.push(base[0] + RANKS[i] + base[2]);
      }
    }
  } else {
    hands.push(token);
  }

  for (const hand of hands) {
    if (!HANDS.includes(hand)) throw new Error(`Bad hand "${hand}" in "${token}"`);
  }
  return hands;
}

function buildRange(name, actions) {
  const range = Array(169).fill("Fold");
  const assigned = new Map();

  for (const [action, notation] of Object.entries(actions)) {
    if (!notation) continue;
    for (const token of notation.split(",")) {
      for (const hand of expandToken(token)) {
        if (assigned.has(hand)) {
          throw new Error(`${name}: ${hand} is both ${assigned.get(hand)} and ${action}`);
        }
        assigned.set(hand, action);
        range[HANDS.indexOf(hand)] = action;
      }
    }
  }
  return { range, name };
}

function combos(hand) {
  if (hand.length === 2) return 6;
  return hand[2] === "s" ? 4 : 12;
}

function summary({ range }) {
  const totals = {};
  range.forEach((action, i) => {
    totals[action] = (totals[action] ?? 0) + combos(HANDS[i]);
  });
  return Object.entries(totals)
    .filter(([action]) => action !== "Fold")
    .map(([action, count]) => `${action} ${((count / 1326) * 100).toFixed(1)}%`)
    .join(", ");
}

const Raise = "Raise";
const Call = "Call";
const AllIn = "All in";

// game -> stack -> situation -> position(s) -> { name, actions }
// Only add ranges taken from a solver or another trusted source. Example:
//
// const RANGES = {
//   cash: {
//     100: {
//       "vs BTN": {
//         BB: { name: "Cash 100bb BB vs BTN RFI", actions: { [Raise]: "...", [Call]: "..." } },
//       },
//     },
//   },
// };
const RANGES = {};

for (const [game, stacks] of Object.entries(RANGES)) {
  for (const [stack, situations] of Object.entries(stacks)) {
    for (const [situation, positions] of Object.entries(situations)) {
      for (const [positionList, { name, actions }] of Object.entries(positions)) {
        const pokerRange = buildRange(name, actions);
        for (const position of positionList.split(",")) {
          const file = join(OUT_DIR, game, stack, situation, `${position}.json`);
          mkdirSync(dirname(file), { recursive: true });
          writeFileSync(file, JSON.stringify(pokerRange));
        }
        console.log(`${name.padEnd(32)} ${summary(pokerRange)}`);
      }
    }
  }
}
