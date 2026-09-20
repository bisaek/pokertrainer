<script lang="ts">
  import { PokerRange } from "../../utils/range.svelte";
  import { blankRangeFor, isRangeCorrect } from "../../utils/practice";
  import { settings } from "../../utils/settings.svelte";

  import RangeLayout from "../range/range-layout.svelte";
  import RangesSelecter from "../range/ranges-selecter.svelte";
  import TrainerOptions from "./trainer-options.svelte";

  let { pokerRange = new PokerRange() }: { pokerRange: PokerRange } = $props();

  let isCorrect: boolean | undefined = $state(undefined);

  const pokerRangesToPractice: PokerRange[] = $state([]);
  let pokerRangesToPracticeFromDrills: PokerRange[] = $state([]);
  // The charts still to rebuild this round. A chart leaves the queue once it
  // has been rebuilt right as many times in a row as the options ask for.
  let queue: { range: PokerRange; streak: number }[] = $state([]);
  let compareTo: PokerRange | undefined = $state(undefined);

  const current = $derived(queue[0]?.range);

  function importRange(e: Event) {
    const files = (e?.target as HTMLInputElement)?.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          pokerRangesToPractice.push(PokerRange.fromJSON(json));
          start();
        } catch (error) {
          console.error("Error parsing JSON:", error);
        }
      };
      reader.readAsText(file);
    });
  }

  function start() {
    queue = [...pokerRangesToPractice, ...pokerRangesToPracticeFromDrills]
      .sort(() => Math.random() - 0.5)
      .map((range) => ({ range, streak: 0 }));
    compareTo = undefined;
    isCorrect = undefined;
    pokerRange = blankRangeFor(current);
  }

  function next() {
    const [item, ...rest] = queue;
    if (!item) return;
    if (isCorrect) {
      const streak = item.streak + 1;
      queue =
        streak >= settings.rangeStreak
          ? rest
          : [...rest, { range: item.range, streak }];
    } else {
      // Wrong: rebuild it again right away, like a drill does. With the
      // repeat option on it also comes back at the end, unless it is
      // already there.
      const again = { range: item.range, streak: 0 };
      queue =
        settings.rangeRepeat && rest.at(-1)?.range !== item.range
          ? [again, ...rest, { range: item.range, streak: 0 }]
          : [again, ...rest];
    }
    compareTo = undefined;
    isCorrect = undefined;
    if (queue.length === 0) {
      start();
    } else {
      pokerRange = blankRangeFor(current);
    }
  }

  function check() {
    compareTo = current;
    isCorrect = compareTo ? isRangeCorrect(pokerRange, compareTo) : undefined;
  }

  function keyPressed(Event: KeyboardEvent) {
    if (["Enter", " "].includes(Event.key)) {
      if (compareTo) {
        next();
      } else {
        check();
      }
    }
  }
</script>

<svelte:window onkeypress={keyPressed} />

<div class="page page-fill">
  <!-- The options sit in the header, so they stay put when the picker is hidden. -->
  <header class="flex items-start gap-4 select-none">
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <span class="eyebrow">Range trainer</span>
      <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <!-- With the name hidden the spot has to be read off the board; the
             name is still given away with the answer. -->
        <h1 class="page-title" data-chart-name>
          {current
            ? settings.chartName || compareTo
              ? current.name
              : "Rebuild the chart for this spot"
            : "Pick a chart to practice"}
        </h1>
        <p class="page-lead">
          Paint the chart from memory, then press Check to compare it with the
          answer.
        </p>
      </div>
    </div>
    <TrainerOptions trainer="range" />
  </header>

  <!-- The picker and the import button can be hidden in the options; they
       are kept mounted so the selection isn't lost while out of sight. -->
  <section
    class="card flex flex-wrap items-start gap-x-6 gap-y-3 py-3 sm:py-3 {settings.picker
      ? ''
      : 'hidden'}"
  >
    <div class="min-w-0 flex-1 basis-[28rem]">
      <RangesSelecter
        changeRanges={(ranges: PokerRange[]) =>
          (pokerRangesToPracticeFromDrills = ranges)}
        {start}
      />
    </div>
    <label class="btn btn-secondary ml-auto self-end">
      Import range files
      <input type="file" class="sr-only" multiple onchange={importRange} />
    </label>
  </section>

  <!-- The answer's outlines can be turned off in the options, for checking
       without being shown the chart. -->
  <RangeLayout
    {pokerRange}
    compareTo={settings.rangeAnswer ? compareTo : undefined}
    {isCorrect}
    spot={current?.spot}
  >
    <div class="flex flex-col gap-3">
      {#if current && settings.progress}
        <p class="text-sm muted" data-charts-left>
          {queue.length}
          {queue.length === 1 ? "chart" : "charts"} left
          {#if settings.rangeStreak > 1}
            · correct in a row: {queue[0].streak}/{settings.rangeStreak}
          {/if}
        </p>
      {/if}
      {#if compareTo}
        <p class="text-sm font-medium {isCorrect ? 'text-emerald-300' : 'text-red-300'}">
          {isCorrect
            ? "Correct!"
            : settings.rangeAnswer
              ? "Not quite. The outlines show the chart."
              : "Not quite."}
        </p>
        <button class="btn btn-primary w-full" onclick={next}>
          Next <span class="kbd" aria-hidden="true">Enter</span>
        </button>
      {:else}
        <button class="btn btn-primary w-full" onclick={check}>
          Check <span class="kbd" aria-hidden="true">Enter</span>
        </button>
      {/if}
    </div>

    {#if pokerRangesToPractice.length > 0}
      <div class="flex flex-col gap-2 border-t border-ink-700 pt-4">
        <span class="label">Imported files</span>
        <ul class="flex flex-col gap-1 text-sm">
          {#each pokerRangesToPractice as range}
            <li>
              <button
                onclick={() => {
                  pokerRange = range;
                }}
                class="link"
              >
                {range.name}
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </RangeLayout>
</div>
