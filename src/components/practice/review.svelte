<script lang="ts">
  import { onMount } from "svelte";
  import HandQuiz from "./hand-quiz.svelte";
  import Range from "@components/range/range.svelte";
  import RangeFilter from "@components/range/range-filter.svelte";
  import { Action, PokerRange } from "@utils/range.svelte";
  import {
    emptyFilter,
    fetchChart,
    fetchManifest,
    matchesFilter,
    rangeInfoFromUrl,
    type FilterItem,
    type RangeFilterValue,
  } from "@utils/manifest";
  import { parse888, type ParsedHand } from "@utils/hand-history-888";
  import type { Question } from "@utils/practice";
  import {
    reviewHands,
    verdictFor,
    type ChartFile,
    type ReviewedDecision,
    type Verdict,
  } from "@utils/preflop-review";

  const STORAGE_KEY = "pokertrainer.preflop-review.v1";

  const verdictInfo: Record<
    Verdict,
    { label: string; help: string; badge: string }
  > = {
    mistake: {
      label: "Mistake",
      help: "Not the action the trainer's chart has for this hand.",
      badge: "badge-mistake",
    },
    good: {
      label: "Good",
      help: "The action the trainer's chart has for this hand.",
      badge: "badge-good",
    },
    outside: {
      label: "Earlier mistake",
      help: "The chart never has this hand in this spot, so an earlier decision was off.",
      badge: "badge-outside",
    },
    uncovered: {
      label: "No chart",
      help: "No chart covers this spot.",
      badge: "badge-none",
    },
  };
  const verdictFilters: (Verdict | "all")[] = [
    "all",
    "mistake",
    "good",
    "outside",
    "uncovered",
  ];

  type Training =
    | { kind: "hands"; questions: Question[] }
    | { kind: "charts"; ranges: PokerRange[] };

  let decisions: ReviewedDecision[] = $state.raw([]);
  let importing = $state(false);
  let importMessage = $state("");
  let rangeFilter: RangeFilterValue = $state(emptyFilter("cash"));
  let verdictFilter: Verdict | "all" = $state("all");
  let selectedKey: string | null = $state(null);
  let selectedChart: { url: string; chart: ChartFile } | null =
    $state.raw(null);
  let training: Training | null = $state.raw(null);

  const chartCache = new Map<string, Promise<ChartFile>>();

  const items = $derived(decisions.map(filterItem));
  // Decisions that pass the range filter; the counts, table and training all use these.
  const inFilter = $derived(
    decisions.filter((_, index) => matchesFilter(items[index], rangeFilter, true))
  );
  const counts = $derived.by(() => {
    const result: Record<Verdict | "all", number> = {
      all: inFilter.length,
      mistake: 0,
      good: 0,
      outside: 0,
      uncovered: 0,
    };
    for (const decision of inFilter) result[decision.verdict]++;
    return result;
  });
  const visible = $derived(
    verdictFilter === "all"
      ? inFilter
      : inFilter.filter((decision) => decision.verdict === verdictFilter)
  );
  const mistakes = $derived(
    inFilter.filter((decision) => decision.verdict === "mistake" && decision.chart)
  );
  // The chart with the hero's action in their hand's cell; borders show the chart's actions.
  const selectedGrid = $derived.by(() => {
    const decision = decisions.find((d) => d.key === selectedKey);
    if (!decision?.chart || selectedChart?.url !== decision.chart.url) return null;
    const answer = chartToRange(selectedChart.chart, selectedChart.url);
    const cells = [...answer.range];
    cells[decision.handIndex] = decision.gradedAction ?? decision.heroAction;
    return { answer, attempt: new PokerRange(answer.name, cells) };
  });

  // Load once. As an $effect this re-ran forever: it writes decisions and
  // rangeFilter, and showGameWithDecisions reads them.
  onMount(() => {
    try {
      const saved: ReviewedDecision[] = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ?? "[]"
      );
      decisions = saved.map(regrade);
      save();
    } catch {
      decisions = [];
    }
    showGameWithDecisions();
  });

  // Decisions saved before grading matched the trainers can say "mixed"; grade them again.
  function regrade(decision: ReviewedDecision): ReviewedDecision {
    if (!decision.chart) return decision;
    const verdict = verdictFor(
      decision.gradedAction ?? decision.heroAction,
      decision.chartAction ?? null
    );
    return verdict === decision.verdict ? decision : { ...decision, verdict };
  }

  function filterItem(decision: ReviewedDecision): FilterItem {
    const info = decision.chart ? rangeInfoFromUrl(decision.chart.url) : null;
    if (info) return info;
    return {
      game: decision.tournament ? "mtt" : "cash",
      stack: null,
      position: decision.position,
      type: decision.spotType ?? null,
      opponent: decision.opponent ?? null,
    };
  }

  // Switch the filter to the game with the most decisions if the current one has none.
  function showGameWithDecisions() {
    const games = decisions.map((decision) => filterItem(decision).game);
    if (games.length === 0 || games.includes(rangeFilter.game)) return;
    const count = (game: string) => games.filter((g) => g === game).length;
    const [mostPlayed] = [...new Set(games)].sort((a, b) => count(b) - count(a));
    rangeFilter = emptyFilter(mostPlayed);
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(decisions));
    } catch {
      // Storage is full or blocked; the review still works until the page is closed.
    }
  }

  function loadChart(url: string): Promise<ChartFile> {
    let chart = chartCache.get(url);
    if (!chart) {
      chart = fetchChart(url) as Promise<ChartFile>;
      // Don't cache a failure: the next attempt should try again.
      chart.catch(() => chartCache.delete(url));
      chartCache.set(url, chart);
    }
    return chart;
  }

  function chartToRange(chart: ChartFile, url: string) {
    return PokerRange.fromJSON(
      chart as { range: Action[]; name: string },
      rangeInfoFromUrl(url) ?? undefined
    );
  }

  async function importFiles(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = [...(input.files ?? [])];
    if (files.length === 0) return;
    importing = true;
    importMessage = "";
    try {
      const hands: ParsedHand[] = [];
      let unreadable = 0;
      for (const file of files) {
        const result = parse888(await file.text());
        hands.push(...result.hands);
        unreadable += result.skipped.length;
      }
      const withoutCards = hands.filter((hand) => !hand.heroCards).length;
      const reviewed = await reviewHands(hands, await fetchManifest(), loadChart);

      const byKey = new Map(decisions.map((decision) => [decision.key, decision]));
      const added = reviewed.filter((decision) => !byKey.has(decision.key)).length;
      for (const decision of reviewed) byKey.set(decision.key, decision);
      decisions = [...byKey.values()].sort(
        (a, b) => b.date.localeCompare(a.date) || b.key.localeCompare(a.key)
      );
      save();
      showGameWithDecisions();

      const skippedNotes: string[] = [];
      if (withoutCards) skippedNotes.push(`${withoutCards} without your hole cards`);
      if (unreadable) skippedNotes.push(`${unreadable} that aren't No Limit Hold'em or couldn't be read`);
      importMessage =
        `Read ${hands.length} hands: ${reviewed.length} preflop decisions, ${added} new.` +
        (skippedNotes.length ? ` Skipped ${skippedNotes.join(" and ")}.` : "");
    } catch (error) {
      importMessage = `Import failed: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      importing = false;
      input.value = "";
    }
  }

  async function select(decision: ReviewedDecision) {
    selectedKey = selectedKey === decision.key ? null : decision.key;
    if (selectedKey === null || !decision.chart) return;
    const url = decision.chart.url;
    selectedChart = { url, chart: await loadChart(url) };
  }

  async function trainMistakes() {
    const ranges = new Map<string, PokerRange>();
    const seen = new Set<string>();
    const questions: Question[] = [];
    for (const decision of mistakes) {
      const url = decision.chart!.url;
      const id = `${url}#${decision.handIndex}`;
      if (seen.has(id)) continue;
      seen.add(id);
      if (!ranges.has(url)) ranges.set(url, chartToRange(await loadChart(url), url));
      questions.push({ range: ranges.get(url)!, hand: decision.handIndex });
    }
    training = { kind: "hands", questions };
  }

  async function practiceMissedCharts() {
    const urls = [...new Set(mistakes.map((decision) => decision.chart!.url))];
    const ranges = await Promise.all(
      urls.map(async (url) => chartToRange(await loadChart(url), url))
    );
    training = { kind: "charts", ranges };
  }

  function clearReview() {
    if (!confirm("Delete every saved decision from this browser?")) return;
    decisions = [];
    selectedKey = null;
    save();
  }

  function formatFrequencies(frequencies: Record<string, number> | null | undefined) {
    if (!frequencies) return "";
    return Object.entries(frequencies)
      .filter(([, frequency]) => frequency >= 0.01)
      .sort((a, b) => b[1] - a[1])
      .map(([action, frequency]) => `${action} ${Math.round(frequency * 100)}%`)
      .join(" · ");
  }
</script>

{#if training}
  <div class="page">
    <header class="flex flex-col gap-3">
      <div>
        <button class="btn btn-ghost -ml-3" onclick={() => (training = null)}>
          <span aria-hidden="true">←</span>
          Back to review
        </button>
      </div>
      <span class="eyebrow">Review</span>
      <h1 class="page-title">
        {training.kind === "hands" ? "Your mistakes" : "Charts you missed"}
      </h1>
    </header>
    {#if training.kind === "hands"}
      <HandQuiz
        ranges={[]}
        fixedQuestions={training.questions}
        onfinish={() => (training = null)}
      />
    {:else}
      <HandQuiz
        ranges={training.ranges}
        count={40}
        onfinish={() => (training = null)}
      />
    {/if}
  </div>
{:else}
  <div class="page">
    <header class="flex flex-col gap-2">
      <span class="eyebrow">Tools</span>
      <h1 class="page-title">Preflop review</h1>
      <p class="page-lead">
        Import 888poker hand histories to check every preflop decision against
        the charts. Reviewed decisions are saved in this browser.
      </p>
    </header>

    <div class="flex flex-wrap items-center gap-3">
      <label class="btn btn-primary">
        {importing ? "Importing…" : "Import hand histories"}
        <input
          type="file"
          accept=".txt,text/plain"
          multiple
          class="hidden"
          disabled={importing}
          onchange={importFiles}
        />
      </label>
      {#if importMessage}
        <p class="text-sm text-ink-300">{importMessage}</p>
      {/if}
      <button
        class="btn btn-ghost ml-auto"
        disabled={decisions.length === 0}
        onclick={clearReview}>Clear saved review</button
      >
    </div>

    {#if decisions.length === 0}
      <div class="card flex flex-col items-center gap-2 border-dashed py-14 text-center">
        <p class="text-lg font-semibold">No reviewed hands yet</p>
        <p class="max-w-md muted">
          Import the .txt hand history files the 888poker client saves. Every
          preflop decision you made is graded against the charts.
        </p>
      </div>
    {:else}
      <section class="card flex flex-col gap-4" data-filter>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
          <h2 class="section-title">Filter</h2>
          <p class="text-sm muted">Narrows the table and what you train.</p>
          <button
            class="btn btn-ghost ml-auto text-sm"
            onclick={() => (rangeFilter = emptyFilter(rangeFilter.game))}
            >Show all</button
          >
        </div>
        <RangeFilter {items} bind:value={rangeFilter} emptyMeansAll />
      </section>

      <div class="flex flex-wrap items-center gap-2">
        {#each verdictFilters as option}
          <button
            class="chip {verdictFilter === option ? 'chip-active' : ''}"
            onclick={() => (verdictFilter = option)}
          >
            {option === "all" ? "All" : verdictInfo[option].label} ({counts[option]})
          </button>
        {/each}
        <div class="ml-auto flex flex-wrap gap-2">
          <button
            class="btn btn-primary"
            disabled={mistakes.length === 0}
            onclick={trainMistakes}>Train mistakes ({mistakes.length})</button
          >
          <button
            class="btn btn-secondary"
            disabled={mistakes.length === 0}
            onclick={practiceMissedCharts}>Practice the charts you missed</button
          >
        </div>
      </div>

      {#if visible.length === 0}
        <p class="muted">No decisions match the filter.</p>
      {:else}
        <div class="card overflow-hidden p-0">
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Game</th>
                  <th>Hand</th>
                  <th>Spot</th>
                  <th>Stack</th>
                  <th>You</th>
                  <th>Chart</th>
                  <th>Verdict</th>
                </tr>
              </thead>
              <tbody>
                {#each visible as decision (decision.key)}
                  <tr
                    class="cursor-pointer transition-colors hover:bg-ink-850 {decision.key ===
                    selectedKey
                      ? 'bg-ink-800'
                      : ''}"
                    onclick={() => select(decision)}
                  >
                    <td class="whitespace-nowrap text-ink-300">{decision.date}</td>
                    <td class="whitespace-nowrap text-ink-300">{decision.tournament ?? decision.stakes}</td>
                    <td class="font-medium whitespace-nowrap">
                      {decision.cards}
                      <span class="font-normal muted">({decision.hand})</span>
                    </td>
                    <td class="whitespace-nowrap">{decision.situation}</td>
                    <td class="whitespace-nowrap tabular-nums">{decision.effectiveBB}bb</td>
                    <td>{decision.heroAction}</td>
                    <td>
                      {decision.chartAction ?? ""}
                    </td>
                    <td>
                      <span
                        class="badge {verdictInfo[decision.verdict].badge}"
                        title={decision.reason ?? verdictInfo[decision.verdict].help}
                      >
                        {verdictInfo[decision.verdict].label}
                      </span>
                    </td>
                  </tr>
                  {#if decision.key === selectedKey}
                    <tr class="bg-ink-850">
                      <td colspan="8">
                        <div class="flex flex-col items-start gap-5 py-2 md:flex-row">
                          {#if selectedGrid}
                            <div class="range-grid w-full max-w-md">
                              <Range
                                pokerRange={selectedGrid.attempt}
                                compareTo={selectedGrid.answer}
                                selectedAction={Action.Fold}
                              />
                            </div>
                          {/if}
                          <div class="flex flex-col gap-2">
                            {#if decision.chart}
                              <p class="font-semibold">{decision.chart.name}</p>
                              <p>
                                {decision.hand}: you chose {decision.heroAction}. The
                                cell shows your action, its outline the chart's.
                              </p>
                              <p class="text-ink-300">
                                {verdictInfo[decision.verdict].help}
                              </p>
                              {#if decision.frequencies}
                                <p class="text-ink-300">
                                  Measured frequencies: {formatFrequencies(
                                    decision.frequencies
                                  )}
                                </p>
                              {/if}
                              {#each decision.chart.notes as note}
                                <p class="text-ink-300">{note}</p>
                              {/each}
                            {:else}
                              <p>{decision.reason ?? verdictInfo[decision.verdict].help}</p>
                            {/if}
                            <p class="text-sm muted">Game #{decision.handId}</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  {/if}
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    {/if}
  </div>
{/if}
