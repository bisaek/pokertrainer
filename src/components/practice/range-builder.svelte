<script lang="ts">
  import {
    PokerRange,
    Action,
    Hand,
    HandStrings,
    PokerRangeLength,
  } from "../../utils/range";

  let { pokerRange = new PokerRange() } = $props<{ pokerRange?: PokerRange }>();

  let selectedAction: Action = $state(Action.Fold);

  function toggleHand(event: MouseEvent, index: number) {
    console.log(event);
    if (event.buttons !== 1) return; // Only proceed if left mouse button is pressed
    pokerRange.range[index] = selectedAction;
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
        return "bg-gray-100 hover:bg-gray-200";
    }
  }
</script>

<div class="flex flex-col items-center space-y-4">
  <div class="grid grid-cols-13 gap-1 w-vw-5 h-vw-5">
    {#each Array(PokerRangeLength) as _, index}
      <!-- svelte-ignore a11y_mouse_events_have_key_events -->
      <button
        class={`p-2 rounded ${getButtonClass(pokerRange.range[index])}`}
        onmouseover={(e) => toggleHand(e, index)}
        title={HandStrings[index]}
      >
        {HandStrings[index]}
      </button>
    {/each}
  </div>
  <div class="">
    {#each Object.values(Action) as action}
      <button
        class={`inline-block px-3 py-1 m-1 rounded ${getButtonClass(action)}`}
        onclick={() => (selectedAction = action)}
      >
        {action}
      </button>
    {/each}
  </div>
</div>
