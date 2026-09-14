<script lang="ts">
  import { onMount } from "svelte";
  import HandQuiz from "./hand-quiz.svelte";
  import Range from "@components/range/range.svelte";
  import RangeFilter from "@components/range/range-filter.svelte";
  import { Action, PokerRange } from "@utils/range.svelte";
  import {
    emptyFilter,
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
      help: "The chart rarely or never takes this action with this hand.",
      badge: "bg-red-500 text-white",
    },
    mixed: {
      label: "Mixed",
      help: "Not the chart's main action, but one it takes some of the time.",
      badge: "bg-yellow-300",
    },
    good: {
      label: "Good",
      help: "The chart's main action, or one it takes at least half the time.",
      badge: "bg-green-500 text-white",
    },
    outside: {
      label: "Earlier mistake",
      help: "The chart never has this hand in this spot, so an earlier decision was off.",
      badge: "bg-gray-400 text-white",
    },
    uncovered: {
      label: "No chart",
      help: "No chart covers this spot.",
      badge: "bg-gray-200",
    },
  };
  const verdictFilters: (Verdict | "all")[] = [
    "all",
    "mistake",
    "mixed",
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
      mixed: 0,
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
    const answer = chartToRange(selectedChart.chart);
    const cells = [...answer.range];
    cells[decision.handIndex] = decision.gradedAction ?? decision.heroAction;
    return { answer, attempt: new PokerRange(answer.name, cells) };
  });

  // Load once. As an $effect this re-ran forever: it writes decisions and
  // rangeFilter, and showGameWithDecisions reads them.
  onMount(() => {
    try {
      decisions = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    } catch {
      decisions = [];
    }
    showGameWithDecisions();
  });

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
      chart = fetch(url).then((response) => response.json());
      chartCache.set(url, chart);
    }
    return chart;
  }

  function chartToRange(chart: ChartFile) {
    return PokerRange.fromJSON(chart as { range: Action[]; name: string });
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
      if (!ranges.has(url)) ranges.set(url, chartToRange(await loadChart(url)));
      questions.push({ range: ranges.get(url)!, hand: decision.handIndex });
    }
    training = { kind: "hands", questions };
  }

  async function practiceMissedCharts() {
    const urls = [...new Set(mistakes.map((decision) => decision.chart!.url))];
    const ranges = await Promise.all(
      urls.map(async (url) => chartToRange(await loadChart(url)))
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
  <div class="p-4 flex flex-col gap-2">
    <div class="flex items-center gap-4">
      <button
        class="bg-gray-300 hover:bg-gray-400 px-3 py-1 rounded"
        onclick={() => (training = null)}>Back to review</button
      >
      <h1 class="text-3xl">
        {training.kind === "hands" ? "Your mistakes" : "Charts you missed"}
      </h1>
    </div>
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
  <div class="p-4 flex flex-col gap-4">
    <div>
      <h1 class="text-3xl">Preflop review</h1>
      <p class="text-gray-600">
        Import 888poker hand histories to check every preflop decision against
        the charts. Reviewed decisions are saved in this browser.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <label class="bg-gray-300 hover:bg-gray-400 px-3 py-1 rounded cursor-pointer">
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
      <button
        class="ml-auto bg-gray-300 hover:bg-gray-400 px-3 py-1 rounded disabled:opacity-50"
        disabled={decisions.length === 0}
        onclick={clearReview}>Clear saved review</button
      >
    </div>
    {#if importMessage}
      <p class="text-sm">{importMessage}</p>
    {/if}

    {#if decisions.length === 0}
      <p class="text-gray-600">
        No reviewed hands yet. Import the .txt hand history files the 888poker
        client saves.
      </p>
    {:else}
      <div class="border rounded p-3 flex flex-col gap-1">
        <div class="flex items-center gap-4">
          <h2 class="text-xl">Filter</h2>
          <p class="text-sm text-gray-600">
            Narrows the table and what you train.
          </p>
          <button
            class="ml-auto text-sm underline cursor-pointer"
            onclick={() => (rangeFilter = emptyFilter(rangeFilter.game))}
            >Show all</button
          >
        </div>
        <RangeFilter {items} bind:value={rangeFilter} emptyMeansAll />
      </div>

      <div class="flex flex-wrap items-center gap-2">
        {#each verdictFilters as option}
          <button
            class="p-2 border rounded cursor-pointer {verdictFilter === option
              ? 'bg-blue-200 hover:bg-blue-300'
              : 'hover:bg-gray-200'}"
            onclick={() => (verdictFilter = option)}
          >
            {option === "all" ? "All" : verdictInfo[option].label} ({counts[option]})
          </button>
        {/each}
        <button
          class="ml-auto bg-gray-300 hover:bg-gray-400 px-3 py-1 rounded disabled:opacity-50"
          disabled={mistakes.length === 0}
          onclick={trainMistakes}>Train mistakes ({mistakes.length})</button
        >
        <button
          class="bg-gray-300 hover:bg-gray-400 px-3 py-1 rounded disabled:opacity-50"
          disabled={mistakes.length === 0}
          onclick={practiceMissedCharts}>Practice the charts you missed</button
        >
      </div>

      {#if visible.length === 0}
        <p class="text-gray-600">No decisions match the filter.</p>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-left border-b">
              <tr>
                <th class="p-2">Date</th>
                <th class="p-2">Game</th>
                <th class="p-2">Hand</th>
                <th class="p-2">Spot</th>
                <th class="p-2">Stack</th>
                <th class="p-2">You</th>
                <th class="p-2">Chart</th>
                <th class="p-2">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {#each visible as decision (decision.key)}
                <tr
                  class="border-b cursor-pointer hover:bg-gray-100 {decision.key ===
                  selectedKey
                    ? 'bg-blue-50'
                    : ''}"
                  onclick={() => select(decision)}
                >
                  <td class="p-2 whitespace-nowrap">{decision.date}</td>
                  <td class="p-2">{decision.tournament ?? decision.stakes}</td>
                  <td class="p-2 whitespace-nowrap">
                    {decision.cards}
                    <span class="text-gray-500">({decision.hand})</span>
                  </td>
                  <td class="p-2">{decision.situation}</td>
                  <td class="p-2 whitespace-nowrap">{decision.effectiveBB}bb</td>
                  <td class="p-2">{decision.heroAction}</td>
                  <td class="p-2">
                    {formatFrequencies(decision.frequencies) ||
                      (decision.chartAction ?? "")}
                  </td>
                  <td class="p-2">
                    <span
                      class="px-2 py-0.5 rounded whitespace-nowrap {verdictInfo[decision.verdict].badge}"
                      title={decision.reason ?? verdictInfo[decision.verdict].help}
                    >
                      {verdictInfo[decision.verdict].label}
                    </span>
                  </td>
                </tr>
                {#if decision.key === selectedKey}
                  <tr>
                    <td colspan="8" class="p-2">
                      <div class="flex flex-col md:flex-row gap-4 items-start">
                        {#if selectedGrid}
                          <div class="grid grid-cols-13 gap-1 w-full max-w-xl aspect-square">
                            <Range
                              pokerRange={selectedGrid.attempt}
                              compareTo={selectedGrid.answer}
                              selectedAction={Action.Fold}
                            />
                          </div>
                        {/if}
                        <div class="flex flex-col gap-1">
                          {#if decision.chart}
                            <p class="font-semibold">{decision.chart.name}</p>
                            <p>
                              {decision.hand}: you chose {decision.heroAction}. The
                              cell shows your action, its border the chart's.
                            </p>
                            <p class="text-gray-600">
                              {verdictInfo[decision.verdict].help}
                            </p>
                            {#each decision.chart.notes as note}
                              <p class="text-gray-600">{note}</p>
                            {/each}
                          {:else}
                            <p>{decision.reason ?? verdictInfo[decision.verdict].help}</p>
                          {/if}
                          <p class="text-gray-500">Game #{decision.handId}</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    {/if}
  </div>
{/if}
