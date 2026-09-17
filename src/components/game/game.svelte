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
  <header class="flex flex-col gap-1 lg:flex-row lg:items-baseline lg:gap-4">
    <div class="flex flex-col gap-1">
      <span class="eyebrow">Play</span>
      <h1 class="page-title">Table game</h1>
    </div>
    <p class="page-lead text-base lg:pb-1">
      The same charts, dealt as hands at a table: your seat, the stacks, what
      the players before you did, and one decision.
    </p>
  </header>

  <div
    class="page-screen-body grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-stretch"
  >
    <div class="flex flex-col gap-4 lg:min-h-0">
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
        <!-- A fixed share of the height: opening the chart after a mistake must not
             crush the table you were just looking at. -->
        <section
          class="card flex items-center justify-center p-4 sm:p-6 lg:min-h-0 lg:shrink-0 lg:grow-0 lg:basis-[58%] lg:[container-type:size]"
        >
          <div class="w-full lg:w-[min(100cqw,177cqh)]">
            <PokerTable
              situation={current.situation}
              cards={current.cards}
              heroAction={chosen === null
                ? null
                : heroActionLabel(chosen, current.situation)}
              result={chosen === null ? null : wasRight ? "correct" : "wrong"}
            />
          </div>
        </section>

        <!-- The chart, when it is opened after a mistake, scrolls in here rather
             than pushing the table off the screen. -->
        <section class="card flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <h2 class="text-xl font-semibold" data-hand>
              {HandStrings[current.hand]} in the {current.info.position}
            </h2>
            <span class="chip chip-active cursor-default" data-chart-name>
              {current.chart.name}
            </span>
          </div>

          {#if chosen === null}
            <div class="grid gap-2 sm:grid-cols-2">
              {#each options as action, index}
                <button
                  class="btn btn-lg justify-between font-semibold hover:brightness-110 {getButtonClass(
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
            <p
              class="text-lg font-semibold {wasRight
                ? 'text-emerald-300'
                : 'text-red-300'}"
              data-result
            >
              {wasRight
                ? "Correct."
                : `Not quite — the chart says ${current.chart.range[current.hand]}.`}
            </p>
            <div class="flex flex-wrap gap-2">
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

          {#if showChart && answered}
            <figure class="flex flex-col gap-2">
              <div class="range-grid">
                <Range
                  selectedAction={Action.Fold}
                  pokerRange={answered}
                  compareTo={current.chart}
                />
              </div>
              <figcaption class="text-center text-xs muted">
                Your hand is filled with the action you chose and outlined with the
                chart's.
              </figcaption>
            </figure>
          {/if}
        </section>
      {/if}
    </div>

    <div class="page-panel flex flex-col gap-6">
      <section class="card flex flex-col gap-3">
        <h2 class="section-title">This session</h2>
        <dl class="grid grid-cols-2 gap-3 text-center">
          <div class="rounded-lg bg-ink-900 py-3">
            <dt class="label">Hands</dt>
            <dd class="text-2xl font-semibold tabular-nums" data-stat-hands>{hands}</dd>
          </div>
          <div class="rounded-lg bg-ink-900 py-3">
            <dt class="label">Correct</dt>
            <dd class="text-2xl font-semibold tabular-nums" data-stat-correct>
              {hands === 0 ? "–" : `${Math.round((correct / hands) * 100)}%`}
            </dd>
          </div>
          <div class="rounded-lg bg-ink-900 py-3">
            <dt class="label">Streak</dt>
            <dd class="text-2xl font-semibold tabular-nums" data-stat-streak>{streak}</dd>
          </div>
          <div class="rounded-lg bg-ink-900 py-3">
            <dt class="label">Best</dt>
            <dd class="text-2xl font-semibold tabular-nums" data-stat-best>{best}</dd>
          </div>
        </dl>
        <button class="btn btn-ghost self-start" onclick={resetScore}>
          Reset score
        </button>
      </section>

      <section class="card flex flex-col gap-4">
        <h2 class="section-title">What gets dealt</h2>
        <RangeFilter
          items={manifest}
          bind:value={filter}
          emptyMeansAll={true}
          onchange={deal}
        />
        <p class="text-xs muted">
          {pool.length} charts in the deck. Bet sizes at the table are ordinary
          examples so the hand looks real; the answer only depends on the chart.
        </p>
      </section>
    </div>
  </div>
</div>
