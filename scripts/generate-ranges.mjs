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
const RANGES = {
  mtt: {
    40: {
      RFI: {
        UTG: { name: "40bb RFI UTG", actions: { [Raise]: "55+,ATs+,A5s-A4s,KTs+,QTs+,JTs,T9s,AJo+,KQo" } },
        "UTG+1": { name: "40bb RFI UTG+1", actions: { [Raise]: "44+,A9s+,A5s-A4s,KTs+,QTs+,JTs,T9s,98s,AJo+,KQo" } },
        "UTG+2": { name: "40bb RFI UTG+2", actions: { [Raise]: "33+,A8s+,A5s-A3s,K9s+,Q9s+,J9s+,T9s,98s,ATo+,KJo+" } },
        LJ: { name: "40bb RFI LJ", actions: { [Raise]: "22+,A2s+,K9s+,Q9s+,J9s+,T8s+,98s,87s,ATo+,KJo+,QJo" } },
        HJ: { name: "40bb RFI HJ", actions: { [Raise]: "22+,A2s+,K7s+,Q9s+,J9s+,T8s+,97s+,87s,76s,A9o+,KTo+,QJo" } },
        CO: { name: "40bb RFI CO", actions: { [Raise]: "22+,A2s+,K5s+,Q8s+,J8s+,T8s+,97s+,86s+,75s+,65s,54s,A7o+,A5o,KTo+,QTo+,JTo" } },
        BTN: { name: "40bb RFI BTN", actions: { [Raise]: "22+,A2s+,K2s+,Q5s+,J7s+,T7s+,96s+,85s+,75s+,64s+,54s,A2o+,K8o+,Q9o+,J9o+,T9o,98o" } },
        SB: { name: "40bb RFI SB", actions: { [Raise]: "22+,A2s+,K2s+,Q6s+,J7s+,T7s+,97s+,86s+,75s+,65s,54s,A2o+,K9o+,Q9o+,J9o+,T9o" } },
      },
      "vs UTG": {
        "UTG+1,UTG+2": {
          name: "40bb UTG+1/+2 vs UTG RFI",
          actions: { [Raise]: "QQ+,AKs,AKo", [Call]: "99-JJ,AJs-AQs,KQs" },
        },
        "LJ,HJ": {
          name: "40bb LJ/HJ vs UTG RFI",
          actions: { [Raise]: "QQ+,AKs,AKo,A5s", [Call]: "88-JJ,AJs-AQs,KQs" },
        },
        CO: {
          name: "40bb CO vs UTG RFI",
          actions: { [Raise]: "QQ+,AKs,AKo,A5s", [Call]: "66-JJ,ATs-AQs,KJs-KQs,QJs,JTs,AQo" },
        },
        BTN: {
          name: "40bb BTN vs UTG RFI",
          actions: { [Raise]: "QQ+,AKs,AKo,A5s-A4s", [Call]: "44-JJ,ATs-AQs,KTs-KQs,QTs-QJs,JTs,T9s,98s,AQo" },
        },
        SB: {
          name: "40bb SB vs UTG RFI",
          actions: { [Raise]: "QQ+,AKs,AKo,A5s-A4s", [Call]: "77-JJ,AJs-AQs,KQs" },
        },
        BB: {
          name: "40bb BB vs UTG RFI",
          actions: {
            [Raise]: "QQ+,AKs,AKo,A5s-A4s",
            [Call]: "22-JJ,A6s-AQs,A3s-A2s,K5s-KQs,Q7s-QJs,J7s-JTs,T7s-T9s,96s-98s,86s-87s,75s-76s,64s-65s,53s-54s,43s,A8o-AQo,KTo-KQo,QTo-QJo,JTo,T9o",
          },
        },
      },
      "vs MP": {
        HJ: {
          name: "40bb HJ vs LJ RFI",
          actions: { [Raise]: "JJ+,AQs+,AKo,A5s", [Call]: "77-TT,ATs-AJs,KJs-KQs,QJs" },
        },
        CO: {
          name: "40bb CO vs LJ/HJ RFI",
          actions: { [Raise]: "JJ+,AQs+,AKo,A5s-A4s", [Call]: "66-TT,ATs-AJs,KTs-KQs,QTs-QJs,JTs,T9s,AQo" },
        },
        BTN: {
          name: "40bb BTN vs LJ/HJ RFI",
          actions: {
            [Raise]: "TT+,AQs+,AQo+,A5s-A4s",
            [Call]: "22-99,A8s-AJs,K9s-KQs,Q9s-QJs,J9s-JTs,T8s-T9s,98s,87s,76s,AJo,KQo",
          },
        },
        SB: {
          name: "40bb SB vs LJ/HJ RFI",
          actions: { [Raise]: "JJ+,AQs+,AQo+,A5s-A4s", [Call]: "66-TT,ATs-AJs,KJs-KQs,QJs,JTs" },
        },
        BB: {
          name: "40bb BB vs LJ/HJ RFI",
          actions: {
            [Raise]: "JJ+,AQs+,AKo,A5s-A4s",
            [Call]: "22-TT,A6s-AJs,A3s-A2s,K4s-KQs,Q5s-QJs,J6s-JTs,T6s-T9s,96s-98s,85s-87s,74s-76s,63s-65s,53s-54s,43s,A5o-AQo,K9o-KQo,Q9o-QJo,J9o-JTo,T9o,98o",
          },
        },
      },
      "vs CO": {
        BTN: {
          name: "40bb BTN vs CO RFI",
          actions: {
            [Raise]: "TT+,AQs+,AQo+,KQo,K9s,A5s-A4s",
            [Call]: "22-99,A8s-AJs,KTs-KQs,Q9s-QJs,J9s-JTs,T8s-T9s,98s,87s,76s,65s,ATo-AJo,KJo",
          },
        },
        SB: {
          name: "40bb SB vs CO RFI",
          actions: {
            [Raise]: "TT+,AJs+,AQo+,KQs,A5s-A4s",
            [Call]: "22-99,A8s-ATs,KTs-KJs,QTs-QJs,JTs,T9s,98s,AJo,KQo",
          },
        },
        BB: {
          name: "40bb BB vs CO RFI",
          actions: {
            [Raise]: "TT+,AQs+,AQo+,A5s-A4s",
            [Call]: "22-99,A6s-AJs,A3s-A2s,K2s-KQs,Q3s-QJs,J5s-JTs,T6s-T9s,96s-98s,85s-87s,74s-76s,63s-65s,53s-54s,43s,A2o-AJo,K8o-KQo,Q9o-QJo,J9o-JTo,T8o-T9o,98o,87o",
          },
        },
      },
      "vs BTN": {
        SB: {
          name: "40bb SB vs BTN RFI",
          actions: {
            [Raise]: "77+,A7s+,A5s-A3s,K9s+,QTs+,JTs,T9s,ATo+,KJo+",
            [Call]: "22-66,A6s,A2s,K8s,Q9s,J9s,98s,87s,76s,A9o,KTo,QJo",
          },
        },
        BB: {
          name: "40bb BB vs BTN RFI",
          actions: {
            [Raise]: "TT+,AQs+,AQo+,A5s-A4s",
            [Call]: "22-99,A6s-AJs,A3s-A2s,K2s-KQs,Q2s-QJs,J4s-JTs,T6s-T9s,96s-98s,85s-87s,74s-76s,63s-65s,53s-54s,43s,A2o-AJo,K7o-KQo,Q8o-QJo,J8o-JTo,T8o-T9o,97o-98o,87o,76o",
          },
        },
      },
      "vs SB": {
        BB: {
          name: "40bb BB vs SB RFI",
          actions: {
            [Raise]: "TT+,AJs+,AQo+,KQs,A5s-A4s",
            [Call]: "22-99,A6s-ATs,A3s-A2s,K2s-KJs,Q2s-QJs,J2s-JTs,T5s-T9s,95s-98s,84s-87s,74s-76s,63s-65s,52s-54s,42s-43s,32s,A2o-AJo,K5o-KQo,Q7o-QJo,J7o-JTo,T7o-T9o,97o-98o,86o-87o,76o,65o",
          },
        },
      },
    },
  },

  cash: {
    100: {
      RFI: {
        UTG: { name: "Cash 100bb RFI UTG", actions: { [Raise]: "22+,A2s+,K9s+,Q9s+,J9s+,T9s,98s,87s,76s,65s,ATo+,KJo+" } },
        HJ: { name: "Cash 100bb RFI HJ", actions: { [Raise]: "22+,A2s+,K8s+,Q9s+,J9s+,T8s+,98s,87s,76s,65s,54s,ATo+,KJo+,QJo" } },
        CO: { name: "Cash 100bb RFI CO", actions: { [Raise]: "22+,A2s+,K5s+,Q8s+,J8s+,T8s+,97s+,86s+,76s,65s,54s,A8o+,KTo+,QTo+,JTo" } },
        BTN: { name: "Cash 100bb RFI BTN", actions: { [Raise]: "22+,A2s+,K2s+,Q4s+,J6s+,T6s+,96s+,85s+,74s+,64s+,53s+,43s,A2o+,K8o+,Q9o+,J9o+,T8o+,98o,87o" } },
        SB: { name: "Cash 100bb RFI SB", actions: { [Raise]: "22+,A2s+,K2s+,Q5s+,J7s+,T7s+,96s+,86s+,75s+,65s,54s,A2o+,K9o+,Q9o+,J9o+,T9o" } },
      },
      "vs UTG": {
        HJ: { name: "Cash 100bb HJ vs UTG RFI", actions: { [Raise]: "TT+,AJs+,AKo,KQs,A5s-A4s" } },
        CO: { name: "Cash 100bb CO vs UTG RFI", actions: { [Raise]: "TT+,ATs+,KJs+,AQo+,A5s-A4s" } },
        BTN: {
          name: "Cash 100bb BTN vs UTG RFI",
          actions: { [Raise]: "QQ+,AKs,AKo,A5s-A4s", [Call]: "22-JJ,ATs-AQs,KJs-KQs,QJs,JTs,T9s,98s,AQo" },
        },
        SB: { name: "Cash 100bb SB vs UTG RFI", actions: { [Raise]: "TT+,AJs+,AQo+,KQs,A5s-A4s" } },
        BB: {
          name: "Cash 100bb BB vs UTG RFI",
          actions: {
            [Raise]: "QQ+,AKs,AKo,A5s-A4s",
            [Call]: "22-JJ,A6s-AQs,A3s-A2s,K9s-KQs,Q9s-QJs,J9s-JTs,T8s-T9s,97s-98s,86s-87s,75s-76s,65s,54s,AJo-AQo,KQo",
          },
        },
      },
      "vs HJ": {
        CO: { name: "Cash 100bb CO vs HJ RFI", actions: { [Raise]: "TT+,ATs+,KJs+,QJs,AQo+,KQo,A5s-A4s" } },
        BTN: {
          name: "Cash 100bb BTN vs HJ RFI",
          actions: {
            [Raise]: "JJ+,AQs+,AKo,A5s-A4s",
            [Call]: "22-TT,A9s-AJs,KTs-KQs,QTs-QJs,JTs,T9s,98s,87s,76s,AJo-AQo,KQo",
          },
        },
        SB: { name: "Cash 100bb SB vs HJ RFI", actions: { [Raise]: "TT+,ATs+,KTs+,QJs,AJo+,KQo,A5s-A4s" } },
        BB: {
          name: "Cash 100bb BB vs HJ RFI",
          actions: {
            [Raise]: "JJ+,AQs+,AKo,A5s-A4s",
            [Call]: "22-TT,A6s-AJs,A3s-A2s,K7s-KQs,Q8s-QJs,J8s-JTs,T8s-T9s,97s-98s,86s-87s,75s-76s,64s-65s,54s,ATo-AQo,KJo-KQo,QJo",
          },
        },
      },
      "vs CO": {
        BTN: {
          name: "Cash 100bb BTN vs CO RFI",
          actions: {
            [Raise]: "TT+,AJs+,AQo+,KQs,A5s-A4s",
            [Call]: "22-99,A8s-ATs,KTs-KJs,QTs-QJs,J9s-JTs,T9s,98s,87s,76s,65s,AJo,KQo",
          },
        },
        SB: { name: "Cash 100bb SB vs CO RFI", actions: { [Raise]: "99+,A9s+,A5s-A4s,KTs+,QTs+,JTs,ATo+,KJo+" } },
        BB: {
          name: "Cash 100bb BB vs CO RFI",
          actions: {
            [Raise]: "TT+,AJs+,AQo+,KQs,A5s-A4s",
            [Call]: "22-99,A6s-ATs,A3s-A2s,K5s-KJs,Q7s-QJs,J7s-JTs,T7s-T9s,96s-98s,85s-87s,75s-76s,64s-65s,53s-54s,A8o-AJo,KTo-KQo,QTo-QJo,JTo",
          },
        },
      },
      "vs BTN": {
        SB: {
          name: "Cash 100bb SB vs BTN RFI",
          actions: { [Raise]: "66+,A7s+,A5s-A2s,K9s+,Q9s+,J9s+,T9s,98s,87s,ATo+,KJo+,QJo" },
        },
        BB: {
          name: "Cash 100bb BB vs BTN RFI",
          actions: {
            [Raise]: "TT+,AJs+,AQo+,KQs,A5s-A4s",
            [Call]: "22-99,A6s-ATs,A3s-A2s,K2s-KJs,Q4s-QJs,J6s-JTs,T6s-T9s,96s-98s,85s-87s,74s-76s,63s-65s,53s-54s,43s,A2o-AJo,K8o-KQo,Q9o-QJo,J9o-JTo,T8o-T9o,98o,87o",
          },
        },
      },
      "vs SB": {
        BB: {
          name: "Cash 100bb BB vs SB RFI",
          actions: {
            [Raise]: "99+,ATs+,A5s-A2s,KJs+,AJo+,KQo",
            [Call]: "22-88,A6s-A9s,K2s-KTs,Q4s-QJs,J6s-JTs,T6s-T9s,96s-98s,85s-87s,74s-76s,64s-65s,53s-54s,43s,A2o-ATo,K8o-KJo,Q9o-QJo,J9o-JTo,T9o,98o",
          },
        },
      },
    },
  },
};

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
