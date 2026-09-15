<script lang="ts">
  import { PokerRange } from "../../utils/range.svelte";
  import { blankRangeFor, isRangeCorrect } from "../../utils/practice";

  import RangeLayout from "../range/range-layout.svelte";
  import RangesSelecter from "../range/ranges-selecter.svelte";

  let { pokerRange = new PokerRange() }: { pokerRange: PokerRange } = $props();

  let isCorrect: boolean | undefined = $state(undefined);

  const pokerRangesToPractice: PokerRange[] = $state([]);
  let pokerRangesToPracticeFromDrills: PokerRange[] = $state([]);
  let pokerRangesHaveNotFinished: PokerRange[] = $state([]);
  let compareTo: PokerRange | undefined = $state(undefined);

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
    pokerRangesHaveNotFinished = [];
    pokerRangesHaveNotFinished.push(
      ...pokerRangesToPractice,
      ...pokerRangesToPracticeFromDrills
    );
    pokerRangesHaveNotFinished.sort(() => Math.random() - 0.5);
    pokerRangesHaveNotFinished = [...pokerRangesHaveNotFinished];
    pokerRange = blankRangeFor(pokerRangesHaveNotFinished[0]);
  }

  function next() {
    if (isCorrect) {
      pokerRangesHaveNotFinished.shift();
    } else if (
      pokerRangesHaveNotFinished[pokerRangesHaveNotFinished.length - 1] !==
      compareTo
    ) {
      pokerRangesHaveNotFinished.push(pokerRangesHaveNotFinished[0]);
    }
    compareTo = undefined;
    isCorrect = undefined;
    if (pokerRangesHaveNotFinished.length === 0) {
      start();
    }
    pokerRange = blankRangeFor(pokerRangesHaveNotFinished[0]);
  }

  function check() {
    compareTo = pokerRangesHaveNotFinished[0];
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

<div class="page">
  <header class="flex flex-col gap-2 select-none">
    <span class="eyebrow">Range trainer</span>
    <h1 class="page-title" data-chart-name>
      {pokerRangesHaveNotFinished[0]?.name ?? "Pick a chart to practice"}
    </h1>
    <p class="page-lead">
      Paint the chart from memory, then press Check to compare it with the
      answer.
    </p>
  </header>

  <RangeLayout {pokerRange} {compareTo} {isCorrect}>
    <div class="flex flex-col gap-3">
      {#if compareTo}
        <p class="text-sm font-medium {isCorrect ? 'text-emerald-300' : 'text-red-300'}">
          {isCorrect ? "Correct!" : "Not quite. The outlines show the chart."}
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

    <div class="flex flex-col gap-3 border-t border-ink-700 pt-4">
      <h2 class="section-title">Charts</h2>
      <RangesSelecter
        changeRanges={(ranges: PokerRange[]) =>
          (pokerRangesToPracticeFromDrills = ranges)}
        {start}
      />
    </div>

    <div class="flex flex-col gap-2 border-t border-ink-700 pt-4">
      <label class="flex flex-col gap-2">
        <span class="label">Import range files</span>
        <input type="file" class="file-input" multiple onchange={importRange} />
      </label>
      {#if pokerRangesToPractice.length > 0}
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
      {/if}
    </div>
  </RangeLayout>
</div>
