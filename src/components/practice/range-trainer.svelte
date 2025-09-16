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

  let isCorrect: boolean = $state(false);

  const pokerRangesToPractice: PokerRange[] = $state([]);
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
    pokerRangesHaveNotFinished.push(...pokerRangesToPractice);
    pokerRangesHaveNotFinished.sort(() => Math.random() - 0.5);
    pokerRangesHaveNotFinished = [...pokerRangesHaveNotFinished];
    console.log(pokerRangesHaveNotFinished);
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
    pokerRange = new PokerRange();
    if (pokerRangesHaveNotFinished.length === 0) {
      start();
    }
    console.log(pokerRangesHaveNotFinished);
  }
</script>

<h1 class="text-4xl text-center">{pokerRangesHaveNotFinished[0]?.name}</h1>
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
        onclick={() => {
          compareTo = pokerRangesHaveNotFinished[0];
          isCorrect =
            pokerRange.range.toString() == compareTo?.range.toString();
        }}>Check</button
      >
    {/if}

    <div class="m-1">
      <label for="">Import: </label>
      <input
        type="file"
        class="border border-gray-300 rounded px-2 py-1"
        multiple
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
