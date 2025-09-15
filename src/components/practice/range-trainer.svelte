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
  let compareTo: PokerRange | undefined = $state(undefined);
  let currentRangeIndex: number = $state(0);
  function importRange(e: Event) {
    const file = (e?.target as HTMLInputElement)?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        pokerRangesToPractice.push(PokerRange.fromJSON(json));
      } catch (error) {
        console.error("Error parsing JSON:", error);
      }
    };
    reader.readAsText(file);
  }
</script>

<h1>{pokerRangesToPractice[currentRangeIndex]?.name}</h1>
<RangeLayout {pokerRange} {compareTo}>
  <div class="flex flex-col">
    <button
      class="bg-gray-300 hover:bg-gray-400 px-3 py-1 m-1 rounded"
      onclick={() => (compareTo = pokerRangesToPractice[currentRangeIndex])}
      >Check</button
    >
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
              currentRangeIndex = index;
            }}
            class="cursor-pointer hover:underline {index === currentRangeIndex
              ? 'font-bold'
              : ''}"
          >
            {range.name}
          </button>
        </li>
      {/each}
    </ul>
  </div>
</RangeLayout>
