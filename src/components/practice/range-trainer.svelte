<script lang="ts">
  import {
    PokerRange,
    Action,
    Hand,
    HandStrings,
    PokerRangeLength,
  } from "../../utils/range.svelte";

  import RangeLayout from "../range/range-layout.svelte";

  let { pokerRange = new PokerRange() }: { pokerRange: PokerRange } = $props();

  const pokerRangesToPractice: PokerRange[] = $state([]);
  let pokerRangesHaveNotFinished: PokerRange[] = $state([]);
  let compareTo: PokerRange | undefined = $state(undefined);
  function importRange(e: Event) {
    const file = (e?.target as HTMLInputElement)?.files?.[0];
    if (!file) return;
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
  }

  function start() {
    pokerRangesHaveNotFinished = [];
    pokerRangesHaveNotFinished.push(...pokerRangesToPractice);
    pokerRangesHaveNotFinished.sort(() => Math.random() - 0.5);
    console.log(pokerRangesHaveNotFinished);
  }

  function next() {
    if (pokerRange.range.toString() == compareTo?.range.toString()) {
      pokerRangesHaveNotFinished.shift();
    } else if (
      pokerRangesHaveNotFinished[pokerRangesHaveNotFinished.length - 1] !==
      compareTo
    ) {
      pokerRangesHaveNotFinished.push(pokerRangesHaveNotFinished[0]);
    }
    compareTo = undefined;
    pokerRange = new PokerRange();
    if (pokerRangesHaveNotFinished.length === 0) {
      start();
    }
    console.log(pokerRangesHaveNotFinished);
  }
</script>

<h1>{pokerRangesHaveNotFinished[0]?.name}</h1>
<RangeLayout {pokerRange} {compareTo}>
  <div class="flex flex-col">
    {#if compareTo}
      <button
        class="bg-gray-300 hover:bg-gray-400 px-3 py-1 m-1 rounded"
        onclick={next}>Next</button
      >
    {:else}
      <button
        class="bg-gray-300 hover:bg-gray-400 px-3 py-1 m-1 rounded"
        onclick={() => (compareTo = pokerRangesHaveNotFinished[0])}
        >Check</button
      >
    {/if}

    <div class="m-1">
      <label for="">Import: </label>
      <input
        type="file"
        class="border border-gray-300 rounded px-2 py-1"
        onchange={importRange}
      />
    </div>
    <ul>
      {#each pokerRangesToPractice as range, index}
        <li>
          <button
            onclick={() => {
              pokerRange = range;
            }}
            class="cursor-pointer hover:underline"
          >
            {range.name}
          </button>
        </li>
      {/each}
    </ul>
  </div>
</RangeLayout>
