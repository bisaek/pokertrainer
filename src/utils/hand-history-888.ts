// Parses 888poker (.com and .dk) No Limit Hold'em hand histories as saved by the client:
//
//   #Game No : 796021165
//   ***** 888poker.dk Snap Poker Hand History for Game 796021165 *****
//   0,05 $/0,10 $ Blinds No Limit Holdem - *** 14 09 2026 14:25:00
//   Table Bellevue 6 Max (Real Money)          (or "Tournament #146056116 $4.50 + $0.50 - Table #1 9 Max")
//   Seat 1 is the button
//   Seat 1: dabenshi ( 10,65 $ )
//   LJ991 posts small blind [0,05 $]
//   ** Dealing down cards **
//   Dealt to bertram2007 [ 6s, 5c ]
//   Bubbleboy14 raises [0,25 $]
//
// Amounts on action lines are the chips added by that action, not "raise to" totals.
// All-ins aren't marked; they show up as a player putting in their whole stack.

export type PreflopAction =
  | { player: string; kind: "post"; post: "small blind" | "big blind" | "ante" | "dead blind"; amount: number }
  | { player: string; kind: "fold" | "check" }
  | { player: string; kind: "call" | "raise" | "bet"; amount: number };

export type ParsedHand = {
  id: string;
  site: string;
  date: string;
  stakes: string;
  bigBlind: number;
  tournament: string | null;
  table: string;
  buttonSeat: number;
  players: { seat: number; name: string; stack: number }[];
  hero: string | null;
  heroCards: [string, string] | null;
  preflop: PreflopAction[];
};

// 888poker.dk writes Danish ranks: B (knægt) for jacks and D (dame) for queens.
const RANK_ALIASES: Record<string, string> = { B: "J", D: "Q", "10": "T" };

export function normalizeCard(card: string): string {
  const rank = card.slice(0, -1).toUpperCase();
  return (RANK_ALIASES[rank] ?? rank) + card.slice(-1).toLowerCase();
}

// Handles "$1,000", "10,65 $", "1.000,50 $", "2,622" chips and dead posts like "$1 + $2".
// The last separator is the decimal point unless exactly three digits follow it.
export function parseAmount(text: string): number {
  if (text.includes("+")) {
    return text.split("+").reduce((sum, part) => sum + parseAmount(part), 0);
  }
  const digits = text.replace(/[^\d.,]/g, "");
  const last = Math.max(digits.lastIndexOf(","), digits.lastIndexOf("."));
  if (last === -1) return Number(digits);
  const whole = digits.slice(0, last).replace(/[.,]/g, "");
  const fraction = digits.slice(last + 1);
  return fraction.length === 3 ? Number(whole + fraction) : Number(`${whole}.${fraction}`);
}

function parseHand(lines: string[]): ParsedHand {
  const titleIndex = lines.findIndex((line) => /Hand History for Game \d+/.test(line));
  if (titleIndex === -1) throw new Error("No game number");
  const id = lines[titleIndex].match(/for Game (\d+)/)![1];
  const site = lines[titleIndex].match(/^\*+\s*(\S+)/)?.[1] ?? "888poker";

  const header = lines[titleIndex + 1] ?? "";
  if (!/No Limit Hold'?em/i.test(header)) throw new Error("Not No Limit Hold'em");
  const stakes = header.split(" Blinds")[0].trim();
  const bigBlindText = stakes.split("/")[1];
  if (!bigBlindText) throw new Error("No blinds");
  const bigBlind = parseAmount(bigBlindText);
  const dateMatch = header.match(/(\d{2}) (\d{2}) (\d{4}) (\d{2}:\d{2}:\d{2})/);
  const date = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]} ${dateMatch[4]}` : "";

  let i = titleIndex + 2;
  let tournament: string | null = null;
  let table = "";
  if (lines[i]?.startsWith("Tournament #")) {
    const separator = lines[i].indexOf(" - Table ");
    tournament = (separator === -1 ? lines[i] : lines[i].slice(0, separator)).trim();
    table = separator === -1 ? "" : lines[i].slice(separator + 3).trim();
    i++;
  } else if (lines[i]?.startsWith("Table ")) {
    table = lines[i];
    i++;
  }

  let buttonSeat: number | null = null;
  const players: ParsedHand["players"] = [];
  for (; i < lines.length; i++) {
    const line = lines[i];
    let match;
    if ((match = line.match(/^Seat (\d+) is the button/))) {
      buttonSeat = Number(match[1]);
    } else if ((match = line.match(/^Seat (\d+): (.+) \( (.+) \)$/))) {
      players.push({ seat: Number(match[1]), name: match[2], stack: parseAmount(match[3]) });
    } else if (!line.startsWith("Total number of players")) {
      break;
    }
  }
  if (buttonSeat === null) throw new Error("No button");

  let hero: string | null = null;
  let heroCards: [string, string] | null = null;
  let dealt = false;
  const preflop: PreflopAction[] = [];
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("** Dealing down cards")) {
      dealt = true;
      continue;
    }
    // Any other "**" line after the deal ("** Dealing flop **", "** Første runout **",
    // "** Summary **") ends preflop.
    if (line.startsWith("**")) {
      if (dealt) break;
      continue;
    }
    let match;
    if ((match = line.match(/^Dealt to (.+) \[\s*(\S+?),\s*(\S+?)\s*\]$/))) {
      hero = match[1];
      heroCards = [normalizeCard(match[2]), normalizeCard(match[3])];
    } else if ((match = line.match(/^(.+) posts (small blind|big blind|ante|dead blind) \[(.+)\]$/))) {
      preflop.push({
        player: match[1],
        kind: "post",
        post: match[2] as "small blind" | "big blind" | "ante" | "dead blind",
        amount: parseAmount(match[3]),
      });
    } else if ((match = line.match(/^(.+) (folds|checks)$/))) {
      preflop.push({ player: match[1], kind: match[2] === "folds" ? "fold" : "check" });
    } else if ((match = line.match(/^(.+) (calls|raises|bets) \[(.+)\]$/))) {
      const kind = ({ calls: "call", raises: "raise", bets: "bet" } as const)[match[2] as "calls" | "raises" | "bets"];
      preflop.push({ player: match[1], kind, amount: parseAmount(match[3]) });
    }
    // Other lines don't change the preflop action.
  }

  return { id, site, date, stakes, bigBlind, tournament, table, buttonSeat, players, hero, heroCards, preflop };
}

// Splits a file into hands and parses each. Hands that can't be read are returned in `skipped`.
export function parse888(text: string): {
  hands: ParsedHand[];
  skipped: { id: string; reason: string }[];
} {
  const lines = text
    .replace(/ /g, " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/^﻿/, "").trim());

  const blocks: string[][] = [];
  for (const line of lines) {
    const previous = blocks.at(-1)?.at(-1) ?? "";
    const startsHand =
      line.startsWith("#Game No") ||
      (/Hand History for Game \d+/.test(line) && !previous.startsWith("#Game No"));
    if (startsHand) blocks.push([]);
    if (line && blocks.length > 0) blocks.at(-1)!.push(line);
  }

  const hands: ParsedHand[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const block of blocks) {
    try {
      hands.push(parseHand(block));
    } catch (error) {
      const id = block.join("\n").match(/Game (?:No\s*:\s*)?(\d+)/)?.[1] ?? "?";
      skipped.push({ id, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return { hands, skipped };
}
