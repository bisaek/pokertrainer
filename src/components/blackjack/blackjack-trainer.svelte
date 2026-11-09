<script lang="ts">
  import { onMount } from "svelte";
  import Card from "@components/practice/card.svelte";
  import BlackjackHeader from "./blackjack-header.svelte";
  import { preloadCards } from "@utils/preload-cards";
  import {
    ACTION_CLASS,
    ACTION_LETTER,
    BjAction,
    CHARTS,
    KIND_NAMES,
    UPCARDS,
    chartAction,
    dealHand,
    handTotal,
    redeal,
    type BjHand,
    type HandKind,
  } from "@utils/blackjack";

  // The rules and what to practice, kept in this browser.
  const STORAGE_KEY = "pokertrainer.blackjack";
  const options = $state({
    hitSoft17: false,
    surrender: true,
    kinds: ["hard", "soft", "pair"] as HandKind[],
    // The chart of the hand being asked, with its cell marked. Off, a chart
    // only shows up after a mistake.
    showChart: false,
  });

  // How many hands go by before a missed one comes back.
  const COMEBACK = 3;

  let hand: BjHand | undefined = $state();
  // Missed hands waiting to come back, with how many hands are still to go.
  let comeback: { hand: BjHand; wait: number }[] = [];
  // The answer to the last hand, shown above the buttons.
  let last:
    | { hand: BjHand; picked: BjAction; answer: BjAction; right: boolean }
    | undefined = $state();
  const stats = $state({ hands: 0, right: 0, streak: 0, best: 0 });

  const actions = Object.values(BjAction);
  const KEYS: Record<string, BjAction> = {
    h: BjAction.Hit,
    s: BjAction.Stand,
    d: BjAction.Double,
    p: BjAction.Split,
    r: BjAction.Surrender,
  };

  const answer = $derived(hand ? chartAction(hand.kind, hand.row, hand.upcard, options) : undefined);
  // The chart beside the table: the current hand's, or the last mistake's.
  const chart = $derived(
    options.showChart && hand
      ? { hand, missed: false }
      : last && !last.right
        ? { hand: last.hand, missed: true }
        : undefined
  );

  onMount(() => {
    preloadCards();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved) Object.assign(options, saved);
      if (!options.kinds.length) options.kinds = ["hard", "soft", "pair"];
    } catch {}
    next();
  });

  $effect(() => {
    const json = JSON.stringify(options);
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch {}
  });

  function available(action: BjAction): boolean {
    if (action === BjAction.Split) return hand?.kind === "pair";
    if (action === BjAction.Surrender) return options.surrender;
    return true;
  }

  function next() {
    comeback.forEach((c) => c.wait--);
    const due = comeback.findIndex((c) => c.wait <= 0 && options.kinds.includes(c.hand.kind));
    if (due >= 0) {
      hand = redeal(comeback[due].hand);
      comeback.splice(due, 1);
    } else {
      hand = dealHand(options.kinds, hand);
    }
  }

  function play(action: BjAction) {
    if (!hand || !answer || !available(action)) return;
    const right = action === answer;
    last = { hand, picked: action, answer, right };
    stats.hands++;
    if (right) {
      stats.right++;
      stats.streak++;
      stats.best = Math.max(stats.best, stats.streak);
    } else {
      stats.streak = 0;
      comeback.push({ hand, wait: COMEBACK });
    }
    next();
  }

  function toggleKind(kind: HandKind) {
    const kinds = options.kinds.includes(kind)
      ? options.kinds.filter((k) => k !== kind)
      : [...options.kinds, kind];
    if (!kinds.length) return;
    options.kinds = kinds;
    if (hand && !kinds.includes(hand.kind)) next();
  }

  function resetStats() {
    Object.assign(stats, { hands: 0, right: 0, streak: 0, best: 0 });
    last = undefined;
    comeback = [];
  }

  function keyDown(event: KeyboardEvent) {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
    const action = KEYS[event.key.toLowerCase()] ?? actions[Number(event.key) - 1];
    if (!action) return;
    event.preventDefault();
    play(action);
  }

  const describe = (h: BjHand) =>
    `${h.kind === "pair" ? `Pair of ${CHARTS.pair[h.row].key === "T" ? "tens" : CHARTS.pair[h.row].key + "s"}` : handTotal(h)} vs ${UPCARDS[h.upcard] === "T" ? "10" : UPCARDS[h.upcard]}`;
</script>

<svelte:window onkeydown={keyDown} />

<div class="page page-fill">
  <BlackjackHeader
    current="strategy"
    lead="Play each hand by basic strategy. A hand you miss comes back a few hands later with other cards."
  />

  <section class="card flex flex-wrap items-center gap-x-6 gap-y-3 py-3 sm:py-3" data-bj-options>
    <div class="flex flex-wrap items-center gap-2">
      <span class="label">Hands</span>
      {#each ["hard", "soft", "pair"] as HandKind[] as kind}
        <button
          class="chip {options.kinds.includes(kind) ? 'chip-active' : ''}"
          aria-pressed={options.kinds.includes(kind)}
          onclick={() => toggleKind(kind)}>{KIND_NAMES[kind]}</button
        >
      {/each}
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <span class="label">Dealer</span>
      <button
        class="chip {options.hitSoft17 ? '' : 'chip-active'}"
        aria-pressed={!options.hitSoft17}
        onclick={() => (options.hitSoft17 = false)}>Stands on soft 17</button
      >
      <button
        class="chip {options.hitSoft17 ? 'chip-active' : ''}"
        aria-pressed={options.hitSoft17}
        onclick={() => (options.hitSoft17 = true)}>Hits soft 17</button
      >
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <button
        class="chip {options.surrender ? 'chip-active' : ''}"
        aria-pressed={options.surrender}
        onclick={() => (options.surrender = !options.surrender)}>Surrender</button
      >
      <button
        class="chip {options.showChart ? 'chip-active' : ''}"
        aria-pressed={options.showChart}
        onclick={() => (options.showChart = !options.showChart)}>Show chart</button
      >
    </div>
  </section>

  <div class="mx-auto grid min-h-0 w-full max-w-6xl flex-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,23rem)] lg:grid-rows-[minmax(0,1fr)] lg:items-stretch">
    <div class="flex flex-col gap-4 lg:min-h-0">
      <!-- The table: the dealer's upcard and hole card, then the player's hand. -->
      <section
        class="bj-felt bj-felt-fit flex flex-col items-center justify-center gap-6 rounded-2xl border border-ink-700 px-4 py-6 sm:py-8 lg:gap-4 lg:py-4"
        style="--bj-card-fit: calc((100cqh - 6.5rem) / 2); --bj-card-max: 11rem"
      >
        {#if hand}
          <div class="flex flex-col items-center gap-2">
            <span class="label text-emerald-100/70">Dealer</span>
            <div class="flex gap-2" data-bj-dealer>
              <Card class="bj-card" rank={hand.dealer[0]} suit={hand.dealer[1]} />
              <Card class="bj-card" rank="2" suit="B" />
            </div>
          </div>
          <div class="flex flex-col items-center gap-2">
            <div class="flex gap-2" data-bj-player>
              <Card class="bj-card" rank={hand.player[0][0]} suit={hand.player[0][1]} />
              <Card class="bj-card" rank={hand.player[1][0]} suit={hand.player[1][1]} />
            </div>
            <span class="rounded-full bg-black/35 px-3 py-1 text-sm font-semibold text-emerald-50" data-bj-total>
              {handTotal(hand)}
            </span>
          </div>
        {:else}
          <p class="py-24 text-emerald-100/70">Shuffling…</p>
        {/if}
      </section>

      <section class="card flex shrink-0 flex-col gap-3">
        <div class="flex min-h-7 flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {#if last}
            <span class="badge {last.right ? 'badge-good' : 'badge-mistake'}" data-bj-feedback>
              {last.right ? "Right" : "Not quite"}
            </span>
            <span class="text-ink-300">
              {describe(last.hand)}:
              {#if last.right}
                <span class="font-semibold text-ink-100">{last.answer}</span>
              {:else}
                you picked {last.picked}, the play is
                <span class="font-semibold text-ink-100">{last.answer}</span>.
              {/if}
            </span>
          {:else}
            <span class="muted">What's the play?</span>
          {/if}
        </div>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {#each actions as action, index}
            <button
              class="btn btn-lg justify-between px-3 font-semibold hover:brightness-110 {ACTION_CLASS[action]}"
              disabled={!available(action)}
              onclick={() => play(action)}
            >
              {action}
              <span class="kbd" aria-hidden="true">{index + 1}</span>
            </button>
          {/each}
        </div>
      </section>

      <section class="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 text-sm muted" data-bj-stats>
        <span><span class="font-semibold text-ink-100 tabular-nums">{stats.hands}</span> hands</span>
        <span>
          <span class="font-semibold text-ink-100 tabular-nums">
            {stats.hands ? Math.round((stats.right / stats.hands) * 100) : 0}%
          </span> right
        </span>
        <span><span class="font-semibold text-ink-100 tabular-nums">{stats.streak}</span> in a row</span>
        <span><span class="font-semibold text-ink-100 tabular-nums">{stats.best}</span> best</span>
        {#if stats.hands}
          <button class="btn btn-ghost ml-auto px-2 py-1" onclick={resetStats}>Reset</button>
        {/if}
      </section>
    </div>

    <!-- The strategy chart for the hand's kind, with its cell marked. -->
    {#if chart}
      {@const rows = CHARTS[chart.hand.kind]}
      <div class="bj-chart-frame">
      <section class="card flex flex-col gap-3" data-bj-chart>
        <div class="flex items-baseline justify-between gap-2">
          <h2 class="section-title">{KIND_NAMES[chart.hand.kind]}</h2>
          {#if chart.missed}<span class="text-sm text-red-300">The hand you missed</span>{/if}
        </div>
        <div
          class="bj-chart grid gap-[2px] text-center text-xs font-semibold tabular-nums"
          style:--rows={rows.length + 1}
        >
          <span></span>
          {#each UPCARDS as up}
            <span class="py-1 text-ink-400">{up === "T" ? "10" : up}</span>
          {/each}
          {#each rows as row, r}
            <span class="flex items-center justify-end pr-1.5 text-ink-400">{row.label}</span>
            {#each UPCARDS as _, u}
              {@const action = chartAction(chart.hand.kind, r, u, options)}
              <span
                class="bj-cell {ACTION_CLASS[action]} {r === chart.hand.row && u === chart.hand.upcard
                  ? 'bj-cell-marked'
                  : ''}"
                title={action}>{ACTION_LETTER[action]}</span
              >
            {/each}
          {/each}
        </div>
        <p class="flex flex-wrap gap-x-3 gap-y-1 text-xs muted">
          {#each actions as action}
            <span><span class="action-dot {ACTION_CLASS[action]}"></span>{ACTION_LETTER[action]} {action}</span>
          {/each}
        </p>
      </section>
      </div>
    {/if}
  </div>

  <p class="shrink-0 text-xs muted">
    Basic strategy for 4 to 8 decks, doubling on any two cards and after a split, dealer peeks for blackjack.
    Keys 1 to 5 pick the buttons in order.
  </p>
</div>

<style>
  .bj-cell-marked {
    box-shadow:
      inset 0 0 0 2px var(--color-ink-950),
      inset 0 0 0 4px #fff;
    filter: brightness(1.2);
  }
</style>
