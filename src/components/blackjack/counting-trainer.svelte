<script lang="ts">
  import { onMount, tick, untrack } from "svelte";
  import Card from "@components/practice/card.svelte";
  import BlackjackHeader from "./blackjack-header.svelte";
  import { preloadCards } from "@utils/preload-cards";
  import { hiLo, randomCard, Shoe, trueCount, trueCountAnswers } from "@utils/card-counting";

  type Drill = "values" | "each" | "running";

  // The drill and how it runs, kept in this browser.
  const STORAGE_KEY = "pokertrainer.counting";
  const options = $state({
    drill: "running" as Drill,
    // Time each card is shown, in ms; 0 deals a card per key press.
    speed: 800,
    // Cards dealt before the count is asked.
    checkEvery: 20,
    decks: 6,
    // Also ask the true count: the running count per deck left.
    askTrue: false,
    // The Hi-Lo chart above the drill, with the card on the table marked.
    showChart: false,
  });

  const SPEEDS = [
    { ms: 1200, name: "Slow" },
    { ms: 800, name: "Medium" },
    { ms: 450, name: "Fast" },
    { ms: 0, name: "Manual" },
  ];
  const CHECKS = [10, 20, 52];
  const DECKS = [1, 2, 6, 8];
  const VALUES = [
    { value: 1, name: "+1", key: "1" },
    { value: 0, name: "0", key: "2" },
    { value: -1, name: "−1", key: "3" },
  ];

  const sign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

  onMount(() => {
    preloadCards();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved) Object.assign(options, saved);
    } catch {}
    newShoe();
    valueCard = randomCard();
    valueShown = performance.now();
    eachNewShoe();
  });

  $effect(() => {
    const json = JSON.stringify(options);
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch {}
  });

  // ---- Card values: name each card's Hi-Lo value as fast as you can. ----

  let valueCard = $state("");
  let valueShown = 0;
  // The last answer. A wrong one keeps the card up until it is answered
  // right, the way the hand trainer asks a missed hand again.
  let valueLast: { card: string; right: boolean } | undefined = $state();
  // The values already tried on this card.
  let valueTried: number[] = $state([]);
  const valueStats = $state({ cards: 0, right: 0, time: 0 });

  function answerValue(value: number) {
    if (!valueCard || valueTried.includes(value)) return;
    const right = hiLo(valueCard) === value;
    valueLast = { card: valueCard, right };
    // A card counts once, and only a first answer counts as right.
    if (!valueTried.length) {
      valueStats.cards++;
      if (right) {
        valueStats.right++;
        valueStats.time += performance.now() - valueShown;
      }
    }
    if (!right) {
      valueTried = [...valueTried, value];
      return;
    }
    valueTried = [];
    let next = randomCard();
    // A new card each time, so a right answer always moves on visibly.
    while (next === valueCard) next = randomCard();
    valueCard = next;
    valueShown = performance.now();
  }

  // ---- Count each card: type the running count after every card. ----

  let eachShoe = new Shoe(6);
  let eachCard = $state("");
  // The running count with the card on the table counted.
  let eachCount = $state(0);
  // Bumped for every card dealt, so the same card twice still flashes.
  let eachDealt = $state(0);
  let eachGuess = $state("");
  // Wrong answers on the card on the table.
  let eachTries = $state(0);
  let eachLast: { right: boolean } | undefined = $state();
  let eachDecksLeft = $state(6);
  let eachShuffled = $state(false);
  let eachShown = 0;
  const eachStats = $state({ cards: 0, right: 0, time: 0 });
  let eachInput: HTMLInputElement | undefined = $state();

  function eachNewShoe() {
    eachShoe = new Shoe(options.decks);
    eachCount = 0;
    eachDraw();
  }

  function eachDraw() {
    eachShuffled = eachShoe.dealt === 0 && eachStats.cards > 0;
    eachCard = eachShoe.draw();
    eachDealt++;
    eachCount += hiLo(eachCard);
    eachDecksLeft = eachShoe.decksLeft;
    eachTries = 0;
    eachGuess = "";
    eachShown = performance.now();
  }

  // A wrong count keeps the card up until it is right; after two misses the
  // count is shown, so the drill can go on from it.
  function eachSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!eachCard || eachGuess.trim() === "" || Number.isNaN(parse(eachGuess))) return;
    const right = parse(eachGuess) === eachCount;
    eachLast = { right };
    if (!eachTries) {
      eachStats.cards++;
      if (right) {
        eachStats.right++;
        eachStats.time += performance.now() - eachShown;
      }
    }
    if (!right) {
      eachTries++;
      eachInput?.select();
      return;
    }
    if (eachShoe.finished) {
      eachShoe = new Shoe(options.decks);
      eachCount = 0;
    }
    eachDraw();
  }

  $effect(() => {
    if (options.drill !== "each") return;
    tick().then(() => eachInput?.focus());
  });

  // ---- Running count: cards come out of a shoe, then the count is asked. ----

  type Phase = "ready" | "dealing" | "asking" | "result";
  let phase: Phase = $state("ready");
  // The shoe changes inside as it deals, so the decks left are kept apart to
  // be drawn.
  let shoe: Shoe = new Shoe(6);
  let decksLeft = $state(6);
  // The running count over the whole shoe, carried from round to round.
  let running = $state(0);
  // The cards of this round, in order.
  let round: string[] = $state([]);
  let shuffled = $state(false);
  let guessRunning = $state("");
  let guessTrue = $state("");
  let result:
    | { running: number; decksLeft: number; runningRight: boolean; trueRight?: boolean; cutCard: boolean }
    | undefined = $state();
  const runStats = $state({ checks: 0, right: 0 });
  let runningInput: HTMLInputElement | undefined = $state();

  const current = $derived(round[round.length - 1]);

  // The Hi-Lo values as a chart: each group of ranks and what it counts.
  const CHART = [
    { value: 1, ranks: ["2", "3", "4", "5", "6"], name: "Low cards" },
    { value: 0, ranks: ["7", "8", "9"], name: "Neutral" },
    { value: -1, ranks: ["10", "J", "Q", "K", "A"], name: "High cards" },
  ];
  // The card on the table in the drill being played, to mark on the chart.
  const tableCard = $derived(
    options.drill === "values"
      ? valueCard
      : options.drill === "each"
        ? eachCard
        : (phase as Phase) === "dealing"
          ? current
          : undefined
  );
  const tableRank = $derived(tableCard ? (tableCard[0] === "T" ? "10" : tableCard[0]) : undefined);

  function newShoe() {
    shoe = new Shoe(options.decks);
    decksLeft = shoe.decksLeft;
    running = 0;
    round = [];
    phase = "ready";
    result = undefined;
    shuffled = false;
  }

  function startRound() {
    if (shoe.finished || shoe.decks !== options.decks) {
      shoe = new Shoe(options.decks);
      decksLeft = shoe.decksLeft;
      running = 0;
      shuffled = true;
    } else {
      shuffled = false;
    }
    round = [];
    result = undefined;
    phase = "dealing";
    if (!options.speed) deal();
  }

  function deal() {
    if (phase !== "dealing") return;
    if (round.length >= options.checkEvery || shoe.finished) return ask();
    const card = shoe.draw();
    running += hiLo(card);
    round = [...round, card];
    decksLeft = shoe.decksLeft;
  }

  async function ask() {
    phase = "asking";
    guessRunning = "";
    guessTrue = "";
    await tick();
    runningInput?.focus();
  }

  // Deals on a timer, or waits for a key press in manual mode.
  $effect(() => {
    if (phase !== "dealing" || !options.speed) return;
    untrack(deal);
    const timer = setInterval(deal, options.speed);
    return () => clearInterval(timer);
  });

  const parse = (text: string) => Number(text.trim().replace("−", "-").replace(/^\+/, ""));

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (guessRunning.trim() === "" || (options.askTrue && guessTrue.trim() === "")) return;
    const runningRight = parse(guessRunning) === running;
    const trueRight = options.askTrue
      ? trueCountAnswers(running, decksLeft).includes(parse(guessTrue))
      : undefined;
    result = { running, decksLeft, runningRight, trueRight, cutCard: shoe.finished };
    runStats.checks++;
    if (runningRight && trueRight !== false) runStats.right++;
    phase = "result";
  }

  function keyDown(event: KeyboardEvent) {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    // A focused button answers Enter and Space by itself.
    if (target?.tagName === "BUTTON" && (event.key === "Enter" || event.key === " ")) return;
    if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

    if (options.drill === "values") {
      const key = event.key === "+" || event.key === "=" ? "1" : event.key === "0" ? "2" : event.key === "-" ? "3" : event.key;
      const value = VALUES.find((v) => v.key === key);
      if (!value) return;
      event.preventDefault();
      answerValue(value.value);
      return;
    }

    if (event.key !== " " && event.key !== "Enter" && event.key !== "ArrowRight") return;
    event.preventDefault();
    if (phase === "ready" || phase === "result") startRound();
    else if (phase === "dealing" && !options.speed) deal();
  }

  function setDecks(decks: number) {
    options.decks = decks;
    newShoe();
    eachNewShoe();
  }

  function resetStats() {
    Object.assign(valueStats, { cards: 0, right: 0, time: 0 });
    Object.assign(runStats, { checks: 0, right: 0 });
    valueLast = undefined;
    valueTried = [];
    Object.assign(eachStats, { cards: 0, right: 0, time: 0 });
    eachLast = undefined;
    newShoe();
    eachNewShoe();
  }
</script>

<svelte:window onkeydown={keyDown} />

<div class="page page-fill">
  <BlackjackHeader
    current="counting"
    lead="Keep the Hi-Lo count: 2 to 6 add one, 7 to 9 add nothing, tens and aces take one away."
  />

  <section class="card flex flex-wrap items-center gap-x-6 gap-y-3 py-3 sm:py-3" data-count-options>
    <div class="flex flex-wrap items-center gap-2">
      <span class="label">Drill</span>
      <button
        class="chip {options.drill === 'values' ? 'chip-active' : ''}"
        aria-pressed={options.drill === "values"}
        onclick={() => (options.drill = "values")}>Card values</button
      >
      <button
        class="chip {options.drill === 'each' ? 'chip-active' : ''}"
        aria-pressed={options.drill === "each"}
        onclick={() => (options.drill = "each")}>Count each card</button
      >
      <button
        class="chip {options.drill === 'running' ? 'chip-active' : ''}"
        aria-pressed={options.drill === "running"}
        onclick={() => (options.drill = "running")}>Running count</button
      >
    </div>
    {#if options.drill === "each"}
      <div class="flex flex-wrap items-center gap-2">
        <span class="label">Decks</span>
        {#each DECKS as decks}
          <button
            class="chip {options.decks === decks ? 'chip-active' : ''}"
            aria-pressed={options.decks === decks}
            onclick={() => setDecks(decks)}>{decks}</button
          >
        {/each}
      </div>
    {:else if options.drill === "running"}
      <div class="flex flex-wrap items-center gap-2">
        <span class="label">Speed</span>
        {#each SPEEDS as speed}
          <button
            class="chip {options.speed === speed.ms ? 'chip-active' : ''}"
            aria-pressed={options.speed === speed.ms}
            onclick={() => (options.speed = speed.ms)}>{speed.name}</button
          >
        {/each}
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="label">Ask every</span>
        {#each CHECKS as count}
          <button
            class="chip {options.checkEvery === count ? 'chip-active' : ''}"
            aria-pressed={options.checkEvery === count}
            onclick={() => (options.checkEvery = count)}>{count} cards</button
          >
        {/each}
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="label">Decks</span>
        {#each DECKS as decks}
          <button
            class="chip {options.decks === decks ? 'chip-active' : ''}"
            aria-pressed={options.decks === decks}
            onclick={() => setDecks(decks)}>{decks}</button
          >
        {/each}
        <button
          class="chip {options.askTrue ? 'chip-active' : ''}"
          aria-pressed={options.askTrue}
          onclick={() => (options.askTrue = !options.askTrue)}>True count</button
        >
      </div>
    {/if}
    <button
      class="chip {options.showChart ? 'chip-active' : ''} sm:ml-auto"
      aria-pressed={options.showChart}
      onclick={() => (options.showChart = !options.showChart)}>Show chart</button
    >
  </section>


  <!-- The drill, with the chart right beside it on a wide screen (the pair
       is centered together, like the board and chart in the hand trainer)
       and above it on a narrow one. On a wide screen the felt takes the
       height that is left. -->
  <div
    class="grid min-h-0 flex-1 items-start gap-6 lg:grid-rows-[minmax(0,1fr)] lg:justify-center {options.showChart
      ? 'lg:grid-cols-[minmax(0,var(--drill-width))_18rem]'
      : 'lg:grid-cols-[minmax(0,var(--drill-width))]'}"
    style:--drill-width={options.drill === "running" ? "40rem" : "34rem"}
  >
    {#if options.drill === "values"}
      <div class="mx-auto flex w-full max-w-[34rem] flex-col gap-4 lg:h-full lg:min-h-0">
        <section
          class="bj-felt bj-felt-fit flex flex-col items-center justify-center gap-3 rounded-2xl border border-ink-700 px-4 py-8"
          style="--bj-card-fit: calc(100cqh - 1rem); --bj-card-max: 12rem"
        >
          {#if valueCard}
            {#key valueStats.cards}
              <div class="count-flash" data-count-card>
                <Card class="bj-card" rank={valueCard[0]} suit={valueCard[1]} />
              </div>
            {/key}
          {/if}
        </section>
        <section class="card flex shrink-0 flex-col gap-3">
          <div class="flex min-h-7 flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {#if valueLast}
              <span class="badge {valueLast.right ? 'badge-good' : 'badge-mistake'}" data-count-feedback>
                {valueLast.right ? "Right" : "Not quite"}
              </span>
              {#if !valueLast.right}
                <span class="text-ink-300">Try again.</span>
              {/if}
            {:else}
              <span class="muted">What does this card count?</span>
            {/if}
          </div>
          <div class="grid grid-cols-3 gap-2">
            {#each VALUES as value}
              <button
                class="btn btn-lg btn-secondary justify-between text-xl font-bold tabular-nums {valueTried.includes(
                  value.value
                )
                  ? 'border-red-400/60 text-red-300'
                  : ''}"
                disabled={valueTried.includes(value.value)}
                onclick={() => answerValue(value.value)}
              >
                {value.name}
                <span class="kbd" aria-hidden="true">{value.key}</span>
              </button>
            {/each}
          </div>
        </section>
        <section class="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 text-sm muted" data-count-stats>
          <span><span class="font-semibold text-ink-100 tabular-nums">{valueStats.cards}</span> cards</span>
          <span>
            <span class="font-semibold text-ink-100 tabular-nums">
              {valueStats.cards ? Math.round((valueStats.right / valueStats.cards) * 100) : 0}%
            </span> right
          </span>
          <span>
            <span class="font-semibold text-ink-100 tabular-nums">
              {valueStats.right ? (valueStats.time / valueStats.right / 1000).toFixed(2) : "–"}s
            </span> a card
          </span>
          {#if valueStats.cards}
            <button class="btn btn-ghost ml-auto px-2 py-1" onclick={resetStats}>Reset</button>
          {/if}
        </section>
        <p class="shrink-0 text-xs muted">Keys: 1 or + for +1, 2 or 0 for 0, 3 or − for −1.</p>
      </div>
    {:else if options.drill === "each"}
      <div class="mx-auto flex w-full max-w-[34rem] flex-col gap-4 lg:h-full lg:min-h-0">
        <section
          class="bj-felt bj-felt-fit relative flex flex-col items-center justify-center gap-3 rounded-2xl border border-ink-700 px-4 py-8"
          style="--bj-card-fit: calc(100cqh - 1rem); --bj-card-max: 12rem"
        >
          <span class="absolute top-3 right-4 text-xs font-semibold text-emerald-100/70" data-count-decks>
            {eachDecksLeft} {eachDecksLeft === 1 ? "deck" : "decks"} left
          </span>
          {#if eachCard}
            {#key eachDealt}
              <div class="count-flash" data-count-card>
                <Card class="bj-card" rank={eachCard[0]} suit={eachCard[1]} />
              </div>
            {/key}
          {/if}
        </section>
        <section class="card flex shrink-0 flex-col gap-3">
          <div class="flex min-h-7 flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {#if eachShuffled && !eachTries}
              <span class="text-accent-300">New shoe: the count starts at 0.</span>
            {:else if eachLast && !eachLast.right}
              <span class="badge badge-mistake" data-count-feedback>Not quite</span>
              <span class="text-ink-300">
                {#if eachTries >= 2}
                  The count is <span class="font-semibold text-ink-100">{sign(eachCount)}</span>. Type it to go on.
                {:else}
                  Try again.
                {/if}
              </span>
            {:else if eachLast}
              <span class="badge badge-good" data-count-feedback>Right</span>
            {:else}
              <span class="muted">Type the running count with this card counted.</span>
            {/if}
          </div>
          <form class="flex gap-2" onsubmit={eachSubmit} data-count-each>
            <input
              bind:this={eachInput}
              bind:value={eachGuess}
              class="input text-lg tabular-nums"
              inputmode="numeric"
              autocomplete="off"
              aria-label="Running count"
              placeholder="Running count, e.g. +3 or -2"
            />
            <button class="btn btn-primary btn-lg">Check <span class="kbd" aria-hidden="true">Enter</span></button>
          </form>
        </section>
        <section class="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 text-sm muted" data-count-stats>
          <span><span class="font-semibold text-ink-100 tabular-nums">{eachStats.cards}</span> cards</span>
          <span>
            <span class="font-semibold text-ink-100 tabular-nums">
              {eachStats.cards ? Math.round((eachStats.right / eachStats.cards) * 100) : 0}%
            </span> right
          </span>
          <span>
            <span class="font-semibold text-ink-100 tabular-nums">
              {eachStats.right ? (eachStats.time / eachStats.right / 1000).toFixed(2) : "–"}s
            </span> a card
          </span>
          {#if eachStats.cards}
            <button class="btn btn-ghost ml-auto px-2 py-1" onclick={resetStats}>Reset</button>
          {/if}
        </section>
        <p class="shrink-0 text-xs muted">The count carries on card after card until the cut card comes out of the shoe.</p>
      </div>
    {:else}
      <div class="mx-auto flex w-full max-w-[40rem] flex-col gap-4 lg:h-full lg:min-h-0">
        <section
          class="bj-felt relative flex min-h-[20rem] flex-col {phase === 'dealing' ? 'bj-felt-fit' : ''} items-center justify-center gap-4 rounded-2xl border border-ink-700 px-4 py-8 lg:min-h-0 lg:py-10"
          style="--bj-card-fit: calc(100cqh - 4rem); --bj-card-max: 12rem"
        >
          <!-- Where the shoe is: how far into the round, and the discard tray. -->
          <div class="absolute inset-x-4 top-3 flex justify-between text-xs font-semibold text-emerald-100/70">
            <span data-count-progress>
              {#if phase === "dealing"}Card {round.length} of {options.checkEvery}{/if}
            </span>
            <span data-count-decks>{decksLeft} {decksLeft === 1 ? "deck" : "decks"} left</span>
          </div>

          {#if phase === "ready"}
            <p class="max-w-sm text-center text-emerald-50">
              Cards come out of a {options.decks}-deck shoe one at a time. Keep the running count; after
              {options.checkEvery} cards you're asked for it. The count carries on until the shoe is shuffled.
            </p>
            <button class="btn btn-primary btn-lg" onclick={startRound}>
              Deal <span class="kbd" aria-hidden="true">Space</span>
            </button>
          {:else if phase === "dealing"}
            {#if current}
              {#key round.length}
                <div class="count-flash" data-count-card>
                  <Card class="bj-card" rank={current[0]} suit={current[1]} />
                </div>
              {/key}
            {/if}
            {#if !options.speed}
              <button class="btn btn-secondary" onclick={deal}>
                Next card <span class="kbd" aria-hidden="true">Space</span>
              </button>
            {/if}
          {:else if phase === "asking"}
            <form class="flex w-full max-w-xs flex-col gap-3" onsubmit={submit} data-count-ask>
              <label class="flex flex-col gap-1 text-sm font-semibold text-emerald-50">
                Running count
                <input
                  bind:this={runningInput}
                  bind:value={guessRunning}
                  class="input text-lg tabular-nums"
                  inputmode="numeric"
                  autocomplete="off"
                  placeholder="e.g. +3 or -2"
                />
              </label>
              {#if options.askTrue}
                <label class="flex flex-col gap-1 text-sm font-semibold text-emerald-50">
                  True count <span class="font-normal text-emerald-100/70">with {decksLeft} decks left</span>
                  <input
                    bind:value={guessTrue}
                    class="input text-lg tabular-nums"
                    inputmode="numeric"
                    autocomplete="off"
                    placeholder="Running count ÷ decks left"
                  />
                </label>
              {/if}
              <button class="btn btn-primary btn-lg">Check <span class="kbd" aria-hidden="true">Enter</span></button>
            </form>
          {:else if phase === "result" && result}
            <div class="flex flex-col items-center gap-2 text-center text-emerald-50" data-count-result>
              <span class="badge {result.runningRight && result.trueRight !== false ? 'badge-good' : 'badge-mistake'}">
                {result.runningRight && result.trueRight !== false ? "Right" : "Not quite"}
              </span>
              <p>
                The running count is <span class="text-xl font-bold tabular-nums">{sign(result.running)}</span>
                {#if !result.runningRight}<span class="text-red-200">(you said {guessRunning})</span>{/if}
              </p>
              {#if result.trueRight !== undefined}
                <p>
                  True count: {sign(result.running)} ÷ {result.decksLeft} decks =
                  <span class="text-xl font-bold tabular-nums">
                    {sign(Number(trueCount(result.running, result.decksLeft).toFixed(1)))}
                  </span>
                  {#if !result.trueRight}<span class="text-red-200">(you said {guessTrue})</span>{/if}
                </p>
              {/if}
              {#if result.cutCard}
                <p class="text-sm text-emerald-100/70">The cut card is out: the next round starts a new shoe at 0.</p>
              {/if}
              <button class="btn btn-primary btn-lg mt-2" onclick={startRound}>
                Keep dealing <span class="kbd" aria-hidden="true">Space</span>
              </button>
            </div>
          {/if}
        </section>

        {#if phase === "dealing" && shuffled && round.length <= 1}
          <p class="text-center text-sm text-accent-300">New shoe: the count starts at 0.</p>
        {/if}

        <!-- After a check: the round's cards with what each one counts. -->
        {#if phase === "result"}
          <section class="card flex flex-col gap-3 lg:min-h-0 lg:overflow-y-auto" data-count-review>
            <h2 class="section-title">This round</h2>
            <div class="flex flex-wrap gap-1.5">
              {#each round as card}
                {@const value = hiLo(card)}
                <span
                  class="flex flex-col items-center rounded-md border border-ink-700 bg-ink-850 px-1.5 py-1 text-xs font-semibold tabular-nums"
                >
                  <span class="text-ink-100">{card[0] === "T" ? "10" : card[0]}</span>
                  <span class={value > 0 ? "text-emerald-300" : value < 0 ? "text-red-300" : "text-ink-400"}
                    >{sign(value)}</span
                  >
                </span>
              {/each}
            </div>
          </section>
        {/if}

        <section class="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 text-sm muted" data-count-stats>
          <span><span class="font-semibold text-ink-100 tabular-nums">{runStats.checks}</span> checks</span>
          <span>
            <span class="font-semibold text-ink-100 tabular-nums">
              {runStats.checks ? Math.round((runStats.right / runStats.checks) * 100) : 0}%
            </span> right
          </span>
          {#if runStats.checks}
            <button class="btn btn-ghost ml-auto px-2 py-1" onclick={resetStats}>Reset</button>
          {/if}
        </section>
        <p class="shrink-0 text-xs muted">
          True count: the running count divided by the decks left in the shoe, read off the discard tray to the
          nearest half deck. Dropping the fraction or rounding are both taken as right.
        </p>
      </div>
    {/if}
    {#if options.showChart}
      <section class="card mx-auto flex w-full max-w-[40rem] flex-col gap-3 self-start max-lg:order-first lg:max-h-full lg:overflow-y-auto" data-count-chart>
        <h2 class="section-title">Hi-Lo values</h2>
        <div class="grid grid-cols-3 gap-2 lg:grid-cols-1">
          {#each CHART as group}
            <div class="flex flex-col gap-2 rounded-xl border border-ink-700 bg-ink-850 p-2.5">
              <div class="flex items-baseline justify-between gap-1">
                <span
                  class="text-2xl font-bold tabular-nums {group.value > 0
                    ? 'text-emerald-300'
                    : group.value < 0
                      ? 'text-red-300'
                      : 'text-ink-300'}">{sign(group.value)}</span
                >
                <span class="hidden text-xs muted sm:inline">{group.name}</span>
              </div>
              <div class="flex flex-wrap gap-1">
                {#each group.ranks as rank}
                  <span
                    class="grid h-8 min-w-7 place-items-center rounded-md px-1 text-sm font-semibold {tableRank === rank
                      ? 'bg-ink-100 text-ink-950'
                      : 'bg-ink-800 text-ink-100'}">{rank}</span
                  >
                {/each}
              </div>
            </div>
          {/each}
        </div>
        <p class="shrink-0 text-xs muted">
          True count = running count ÷ decks left. A higher true count means more tens and aces are left, which is
          good for the player.
        </p>
      </section>
    {/if}
  </div>
</div>

<style>
  .count-flash {
    animation: count-flash 120ms ease-out;
  }
  @keyframes count-flash {
    from {
      opacity: 0.2;
      transform: translateY(4px);
    }
  }
</style>
