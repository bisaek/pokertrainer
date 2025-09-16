<script lang="ts">
  import {
    PokerRange,
    Action,
    Hand,
    HandStrings,
    PokerRangeLength,
    getButtonClass,
  } from "../../utils/range.svelte";

  let {
    pokerRange = new PokerRange(),
    selectedAction = Action.Fold,
    compareTo = undefined,
  }: {
    pokerRange: PokerRange;
    selectedAction: Action;
    compareTo?: PokerRange;
  } = $props();

  function toggleHand(event: MouseEvent, index: number) {
    // console.log(event);
    if (event.buttons !== 1) return; // Only proceed if left mouse button is pressed
    pokerRange.range[index] = selectedAction;
    //pokerRange = new PokerRange(pokerRange.name, [...pokerRange.range]); // Trigger reactivity
  }

  function getCompareClass(index: number): string {
    if (!compareTo) return "";

    switch (compareTo.range[index]) {
      case Action.Raise:
        return "border-4 border-red-500";
      case Action.Call:
        return "border-4 border-green-500";
      case Action.Fold:
        return "border-4 border-gray-300";
      case Action.AllIn:
        return "border-4 border-blue-500";
    }
  }
</script>

{#each Array(PokerRangeLength) as _, index}
  <!-- svelte-ignore a11y_mouse_events_have_key_events -->
  <button
    class={`rounded ${getButtonClass(pokerRange.range[index])} ${getCompareClass(index)}`}
    onmouseover={(e) => toggleHand(e, index)}
    onmousedown={(e) => toggleHand(e, index)}
    title={HandStrings[index]}
  >
    {HandStrings[index]}
  </button>
{/each}
