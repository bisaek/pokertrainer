<script lang="ts">
  import {
    PokerRange,
    Action,
    Hand,
    HandStrings,
    PokerRangeLength,
  } from "../../utils/range";

  export let pokerRange: PokerRange = new PokerRange();

  function toggleHand(index: number) {
    const currentAction = pokerRange.range[index];
    let newAction: Action;

    switch (currentAction) {
      case Action.Fold:
        newAction = Action.Call;
        break;
      case Action.Call:
        newAction = Action.Raise;
        break;
      case Action.Raise:
        newAction = Action.AllIn;
        break;
      case Action.AllIn:
        newAction = Action.Fold;
        break;
      default:
        newAction = Action.Fold;
    }

    pokerRange.range[index] = newAction;
    pokerRange = new PokerRange([...pokerRange.range]); // Trigger reactivity
  }

  function getButtonClass(action: Action): string {
    switch (action) {
      case Action.Fold:
        return "bg-gray-300 hover:bg-gray-400";
      case Action.Call:
        return "bg-blue-500 hover:bg-blue-600 text-white";
      case Action.Raise:
        return "bg-green-500 hover:bg-green-600 text-white";
      case Action.AllIn:
        return "bg-red-500 hover:bg-red-600 text-white";
      default:
        return "bg-gray-300 hover:bg-gray-400";
    }
  }
</script>

<div class="grid grid-cols-13 gap-1 w-vw-5 h-vw-5">
  {#each Array(PokerRangeLength) as _, index}
    <button
      class={`p-2 rounded ${getButtonClass(pokerRange.range[index])}`}
      on:click={() => toggleHand(index)}
      title={HandStrings[index]}
    >
      {HandStrings[index]}
    </button>
  {/each}
</div>
