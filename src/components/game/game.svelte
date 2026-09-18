<script lang="ts">
  import { onMount } from "svelte";
  import {
    Action,
    getButtonClass,
    HandStrings,
    PokerRange,
  } from "@utils/range.svelte";
  import {
    emptyFilter,
    fetchChart,
    fetchManifest,
    matchesFilter,
    rangeUrl,
    type RangeFilterValue,
    type RangeInfo,
  } from "@utils/manifest";
  import { pickQuestions } from "@utils/practice";
  import {
    actionLabel,
    buildSituation,
    heroActionLabel,
    type Situation,
  } from "@utils/table";
  import RangeFilter from "@components/range/range-filter.svelte";
  import Range from "@components/range/range.svelte";
  import Card from "@components/practice/card.svelte";
  import PokerTable from "./poker-table.svelte";

  type Hand = {
    info: RangeInfo;
    chart: PokerRange;
    hand: number;
    cards: [string, string][];
    situation: Situation;
  };

  const STORAGE_KEY = "pokertrainer.game.v1";
  const SUITS = ["C", "D", "H", "S"];

  let manifest: RangeInfo[] = $state.raw([]);
  let filter: RangeFilterValue = $state(emptyFilter("cash"));
  let current = $state<Hand | null>(null);
  let chosen: Action | null = $state(null);
  let loading = $state(true);
  let loadError: string | null = $state(null);
  let showChart = $state(false);

  // The hands played this session, newest first, so the space under the actions
  // shows your run rather than sitting empty.
  type Played = { hand: string; chart: string; chose: Action; answer: Action | null };
  let log: Played[] = $state.raw([]);
  let hands = $state(0);
  let correct = $state(0);
  let streak = $state(0);
  let best = $state(0);

  // Charts stay loaded, so a spot that comes up again deals instantly.
  const charts = new Map<string, PokerRange>();

  const pool = $derived(
    manifest.filter((info) => matchesFilter(info, filter, true))
  );
  const wasRight = $derived(
    chosen !== null && current !== null && current.chart.range[current.hand] === chosen
  );
  // Only the actions this chart actually uses, so the buttons match the spot.
  const options = $derived.by(() => {
    if (!current) return [];
    const used = new Set(current.chart.range.filter((action) => action !== null));
    used.add(Action.Fold);
    return Object.values(Action).filter((action) => used.has(action));
  });

  onMount(async () => {
    try {
      manifest = await fetchManifest();
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      hands = stored.hands ?? 0;
      correct = stored.correct ?? 0;
      best = stored.best ?? 0;
    } catch (error) {
      console.error(error);
    }
    await deal();
  });

  async function loadChart(info: RangeInfo): Promise<PokerRange> {
    const url = rangeUrl(info);
    const cached = charts.get(url);
    if (cached) return cached;
    const chart = PokerRange.fromJSON(
      (await fetchChart(url)) as { range: Action[]; name: string }
    );
    charts.set(url, chart);
    return chart;
  }

  async function deal() {
    const spots = pool;
    if (spots.length === 0) {
      current = null;
      loading = false;
      return;
    }
    loading = true;
    loadError = null;
    chosen = null;
    showChart = false;
    const info = spots[Math.floor(Math.random() * spots.length)];
    try {
      const chart = await loadChart(info);
      const [question] = pickQuestions([chart], 1);
      if (!question) throw new Error(`${chart.name} has no hands to play`);
      const positions = [
        ...new Set(
          manifest
            .filter((seat) => seat.game === info.game && seat.stack === info.stack)
            .map((seat) => seat.position)
        ),
      ];
      current = {
        info,
        chart,
        hand: question.hand,
        cards: dealCards(question.hand),
        situation: buildSituation(info, positions),
      };
    } catch (error) {
      loadError = error instanceof Error ? error.message : String(error);
    }
    loading = false;
  }

  // Two cards that make the hand: same suit for a suited hand, different for the rest.
  function dealCards(hand: number): [string, string][] {
    const name = HandStrings[hand];
    const first = SUITS[Math.floor(Math.random() * SUITS.length)];
    let second = first;
    if (!name.endsWith("s")) {
      const others = SUITS.filter((suit) => suit !== first);
      second = others[Math.floor(Math.random() * others.length)];
    }
    return [
      [name[0], first],
      [name[1], second],
    ];
  }

  function play(action: Action) {
    if (!current || chosen !== null) return;
    chosen = action;
    hands++;
    log = [
      {
        hand: HandStrings[current.hand],
        chart: current.chart.name,
        chose: action,
        answer: current.chart.range[current.hand],
      },
      ...log,
    ].slice(0, 40);
    if (current.chart.range[current.hand] === action) {
      correct++;
      streak++;
      best = Math.max(best, streak);
    } else {
      streak = 0;
      showChart = true;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ hands, correct, best }));
    } catch (error) {
      console.error(error);
    }
  }

  function resetScore() {
    log = [];
    hands = 0;
    correct = 0;
    streak = 0;
    best = 0;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error(error);
    }
  }

  // Keys 1-4 play an action; Enter or space deals the next hand.
  function keyDown(event: KeyboardEvent) {
    if (event.repeat) return;
    const target = event.target as HTMLElement | null;
    if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
    if (chosen === null) {
      const action = options[Number(event.key) - 1];
      if (!action) return;
      event.preventDefault();
      play(action);
    } else if (["Enter", " "].includes(event.key)) {
      event.preventDefault();
      deal();
    }
  }

  // The chart with the hero's answer painted in, outlined with the real answer.
  const answered = $derived.by(() => {
    if (!current || chosen === null) return undefined;
    const copy = new PokerRange(current.chart.name, [...current.chart.range]);
    copy.range[current.hand] = chosen;
    return copy;
  });
</script>

<svelte:window onkeydown={keyDown} />

<div class="page page-screen">
  <header class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
    <h1 class="page-title">Table game</h1>
    <p class="page-lead">
      The charts dealt as hands: your seat, the action in front of you, one decision.
    </p>
  </header>

  <div
    class="page-screen-body grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-stretch"
  >
    <div class="flex flex-col gap-3 lg:min-h-0">
      {#if loadError}
        <section
          class="card flex flex-col items-center gap-3 border-red-500/40 py-12 text-center"
          data-load-error
        >
          <p class="text-lg font-semibold">This hand's chart didn't load</p>
          <p class="max-w-md text-sm muted">{loadError}</p>
          <button class="btn btn-primary" onclick={deal}>Try again</button>
        </section>
      {:else if loading && !current}
        <p class="py-12 text-center muted">Dealing…</p>
      {:else if !current}
        <p class="py-12 text-center muted">
          No charts match the filter, so there is nothing to deal.
        </p>
      {:else}
        <!-- The spot, then the hand, then what you do with it: one column, nothing
             reserved for decoration. The chart takes the same card when you open
             it, since you never need both at once. -->
        <section class="card flex shrink-0 flex-col gap-3">
          <PokerTable
            situation={current.situation}
            heroAction={chosen === null
              ? null
              : heroActionLabel(chosen, current.situation)}
            result={chosen === null ? null : wasRight ? "correct" : "wrong"}
          />

          <div class="flex flex-wrap items-center gap-3 border-t border-ink-800 pt-3">
            <div class="flex shrink-0 gap-1.5 [&_img]:h-16 [&_img]:w-auto" data-hero-cards>
              {#each current.cards as [rank, suit]}
                <Card {rank} {suit} />
              {/each}
            </div>
            <div class="flex min-w-0 flex-1 flex-col gap-2">
              <div class="flex flex-wrap items-baseline gap-2">
                <span class="text-sm font-semibold text-ink-100" data-hand>
                  {HandStrings[current.hand]} in the {current.info.position}
                </span>
                <span class="chip-static" data-chart-name>{current.chart.name}</span>
              </div>
              {#if chosen === null}
                <div class="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                  {#each options as action, index}
                    <button
                      class="btn justify-between font-semibold hover:brightness-110 {getButtonClass(
                        action
                      )}"
                      onclick={() => play(action)}
                      data-action={action}
                    >
                      {actionLabel(action, current.situation)}
                      <span class="kbd" aria-hidden="true">{index + 1}</span>
                    </button>
                  {/each}
                </div>
              {:else}
                <div class="flex flex-wrap items-center gap-3">
                  <p
                    class="text-sm font-semibold {wasRight
                      ? 'text-emerald-400'
                      : 'text-red-400'}"
                    data-result
                  >
                    {wasRight
                      ? "Correct."
                      : `Not quite — the chart says ${current.chart.range[current.hand]}.`}
                  </p>
                  <button class="btn btn-primary" onclick={deal} data-next>
                    Next hand <span class="kbd" aria-hidden="true">Enter</span>
                  </button>
                  <button
                    class="btn btn-secondary"
                    onclick={() => (showChart = !showChart)}
                  >
                    {showChart ? "Hide the chart" : "Show the chart"}
                  </button>
                </div>
              {/if}
            </div>
          </div>

          {#if showChart && answered}
            <div
              class="flex flex-col items-center gap-2 border-t border-ink-800 pt-3 lg:[container-type:size]"
            >
              <div class="w-full max-w-[26rem]">
                <div class="range-grid">
                  <Range
                    selectedAction={Action.Fold}
                    pokerRange={answered}
                    compareTo={current.chart}
                  />
                </div>
              </div>
              <p class="text-xs text-ink-500">
                Your answer is filled in, the chart's is outlined.
              </p>
            </div>
          {/if}
        </section>

        <!-- The hands played, filling the rest of the column rather than leaving it
             empty; the newest is on top. -->
        <section class="card flex flex-col gap-2 p-0 lg:min-h-0 lg:flex-1">
          <div
            class="flex items-baseline justify-between border-b border-ink-800 px-3 pt-2 pb-1.5"
          >
            <span class="label">Hands played</span>
            <span class="label">You · chart</span>
          </div>
          {#if log.length === 0}
            <p class="px-3 pb-3 text-xs text-ink-500">
              Every hand you play is listed here with what the chart said.
            </p>
          {:else}
            <ol class="min-h-0 flex-1 overflow-y-auto pb-1 text-xs" data-log>
                {#each log as played, index}
                  <li
                    class="flex items-baseline gap-3 border-b border-ink-850 px-3 py-1 last:border-0
                      {index === 0 ? 'text-ink-300' : 'text-ink-400'}"
                  >
                    <span class="w-10 shrink-0 font-semibold tabular-nums text-ink-100">
                      {played.hand}
                    </span>
                    <span class="flex-1 truncate">{played.chart}</span>
                    <span class="shrink-0">{played.chose}</span>
                    <span
                      class="w-16 shrink-0 text-right {played.chose === played.answer
                        ? 'text-emerald-400'
                        : 'text-red-400'}"
                    >
                      {played.chose === played.answer ? "correct" : played.answer}
                    </span>
                  </li>
                {/each}
              </ol>
            {/if}
          </section>
      {/if}
    </div>

    <div class="page-panel flex flex-col gap-3">
      <section class="card flex flex-col gap-2">
        <div class="flex items-baseline justify-between">
          <h2 class="section-title">This session</h2>
          <button class="btn btn-ghost -mr-2 text-xs" onclick={resetScore}>Reset</button>
        </div>
        <dl class="grid grid-cols-4 gap-2 text-center">
          <div>
            <dt class="label">Hands</dt>
            <dd class="text-lg font-semibold tabular-nums" data-stat-hands>{hands}</dd>
          </div>
          <div>
            <dt class="label">Right</dt>
            <dd class="text-lg font-semibold tabular-nums" data-stat-correct>
              {hands === 0 ? "–" : `${Math.round((correct / hands) * 100)}%`}
            </dd>
          </div>
          <div>
            <dt class="label">Streak</dt>
            <dd class="text-lg font-semibold tabular-nums" data-stat-streak>{streak}</dd>
          </div>
          <div>
            <dt class="label">Best</dt>
            <dd class="text-lg font-semibold tabular-nums" data-stat-best>{best}</dd>
          </div>
        </dl>
      </section>

      <section class="card flex flex-col gap-3">
        <h2 class="section-title">What gets dealt</h2>
        <RangeFilter
          items={manifest}
          bind:value={filter}
          emptyMeansAll={true}
          onchange={deal}
        />
        <p class="text-xs text-ink-500">
          {pool.length} charts in the deck. Bet sizes are ordinary examples; the answer
          only depends on the chart.
        </p>
      </section>
    </div>
  </div>
</div>
