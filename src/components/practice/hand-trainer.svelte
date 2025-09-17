<script lang="ts">
  import {
    Action,
    getButtonClass,
    Hand,
    HandStrings,
    PokerRange,
    PokerRangeLength,
  } from "@utils/range.svelte";
  import Range from "@components/range/range.svelte";

  let handsNotFinished: Hand[] = $state([]);
  let compareTo: PokerRange | undefined = $state();
  let compareToWithMistakes: PokerRange | undefined = $state();
  function importRange(e: Event) {
    const file = (e?.target as HTMLInputElement)?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        compareTo = PokerRange.fromJSON(json);
        start();
      } catch (error) {
        console.error("Error parsing JSON:", error);
      }
    };
    reader.readAsText(file);
  }

  function start() {
    handsNotFinished = [...Array(PokerRangeLength).keys()];
    handsNotFinished.sort(() => Math.random() - 0.5);
  }

  function check(action: Action) {
    if (compareTo?.range[handsNotFinished[0]] === action) {
      compareToWithMistakes = undefined;
      handsNotFinished.shift();
    } else {
      if (
        handsNotFinished[handsNotFinished.length - 1] !== handsNotFinished[0]
      ) {
        handsNotFinished.push(handsNotFinished[0]);
      }
      if (compareTo) {
        compareToWithMistakes = new PokerRange("range", [...compareTo.range]);
        compareToWithMistakes.range[handsNotFinished[0]] = action;
      }
    }
    if (handsNotFinished.length === 0) {
      alert("You have finished the range!");
      start();
    }
    console.log(handsNotFinished);
  }
</script>

<div class="flex flex-row items-center justify-around">
  <div class="flex flex-col w-200">
    {#if compareTo}
      <div class="flex flex-row gap-8 justify-center">
        <h2 class="text-4xl text-center">{HandStrings[handsNotFinished[0]]}</h2>
        <span>{handsNotFinished.length}</span>
      </div>

      <div class="flex flex-row justify-center">
        {#each Object.values(Action) as action}
          <button
            class={`inline-block px-3 py-1 m-1 rounded ${getButtonClass(action)}`}
            onclick={() => check(action)}
          >
            {action}
          </button>
        {/each}
      </div>
      <div class="grid grid-cols-13 gap-1 h-200 w-200">
        {#if compareToWithMistakes}
          <Range
            selectedAction={Action.Fold}
            pokerRange={compareToWithMistakes}
            {compareTo}
          />
        {/if}
      </div>
    {/if}
  </div>

  <div class="m-1">
    <label for="">Import range to practice: </label>
    <input
      type="file"
      class="border border-gray-300 rounded px-2 py-1"
      onchange={importRange}
    />
  </div>
</div>
