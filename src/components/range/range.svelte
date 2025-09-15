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
  }: { pokerRange: PokerRange; selectedAction: Action } = $props();

  function toggleHand(event: MouseEvent, index: number) {
    console.log(event);
    if (event.buttons !== 1) return; // Only proceed if left mouse button is pressed
    pokerRange.range[index] = selectedAction;
    //pokerRange = new PokerRange(pokerRange.name, [...pokerRange.range]); // Trigger reactivity
  }
</script>

{#each Array(PokerRangeLength) as _, index}
  <!-- svelte-ignore a11y_mouse_events_have_key_events -->
  <button
    class={`rounded ${getButtonClass(pokerRange.range[index])}`}
    onmouseover={(e) => toggleHand(e, index)}
    onmousedown={(e) => toggleHand(e, index)}
    title={HandStrings[index]}
  >
    {HandStrings[index]}
  </button>
{/each}
