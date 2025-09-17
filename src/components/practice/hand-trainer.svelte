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
  import Card from "./card.svelte";

  let handsNotFinished: Hand[] = $state([]);
  let compareTo: PokerRange | undefined = $state();
  let compareToWithMistakes: PokerRange | undefined = $state();
  let cardSuits: String[] = $state(["C", "D"]);
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
    randomCardSuits();
  }

  function check(action: Action) {
    if (compareTo?.range[handsNotFinished[0]] === action) {
      compareToWithMistakes = undefined;
      handsNotFinished.shift();
      randomCardSuits();
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

  function randomCardSuits() {
    const suits = ["C", "D", "H", "S"];
    cardSuits[0] = suits[Math.floor(Math.random() * suits.length)];

    if (HandStrings[handsNotFinished[0]].slice(-1) === "s") {
      cardSuits[1] = cardSuits[0];
    } else {
      do {
        cardSuits[1] = suits[Math.floor(Math.random() * suits.length)];
      } while (cardSuits[1] === cardSuits[0]);
    }

    console.log(cardSuits);
  }
</script>

<div class="flex flex-row items-center justify-around">
  <div class="flex flex-col w-200">
    {#if compareTo}
      <p class="text-center">hands back: {handsNotFinished.length}</p>
      <h2 class="text-4xl text-center">{HandStrings[handsNotFinished[0]]}</h2>
      <div class="flex flex-row gap-8 justify-center">
        <Card
          rank={HandStrings[handsNotFinished[0]].charAt(0)}
          suit={cardSuits[0]}
        />
        <Card
          rank={HandStrings[handsNotFinished[0]].charAt(1)}
          suit={cardSuits[1]}
        />
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
    {/if}
  </div>

  <div class="m-1">
    <div class="grid grid-cols-13 gap-1 h-200 w-200">
      {#if compareToWithMistakes}
        <Range
          selectedAction={Action.Fold}
          pokerRange={compareToWithMistakes}
          {compareTo}
        />
      {/if}
    </div>
    <label for="">Import range to practice: </label>
    <input
      type="file"
      class="border border-gray-300 rounded px-2 py-1"
      onchange={importRange}
    />
  </div>
</div>
