<script lang="ts">
  import {
    PokerRange,
    Action,
    Hand,
    HandStrings,
    PokerRangeLength,
  } from "../../utils/range";

  let { pokerRange = new PokerRange() }: { pokerRange: PokerRange } = $props();

  let selectedAction: Action = $state(Action.Fold);

  function toggleHand(event: MouseEvent, index: number) {
    console.log(event);
    if (event.buttons !== 1) return; // Only proceed if left mouse button is pressed
    pokerRange.range[index] = selectedAction;
    pokerRange = new PokerRange(pokerRange.name, [...pokerRange.range]); // Trigger reactivity
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

  function downloadRange() {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(pokerRange.toJSON()));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", pokerRange.name + ".json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }
</script>

<div class="flex flex-row justify-center gap-8 h-screen">
  <div class="grid grid-cols-13 gap-1 h-200 w-200 my-auto">
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
  </div>
  <div class="flex flex-col justify-between my-auto h-200">
    <div class="flex flex-col">
      {#each Object.values(Action) as action}
        <button
          class={`inline-block px-3 py-1 m-1 rounded ${getButtonClass(action)} ${
            selectedAction === action
              ? "ring-4 ring-offset-2 ring-blue-300"
              : ""
          }`}
          onclick={() => (selectedAction = action)}
        >
          {action}
        </button>
      {/each}
    </div>
    <div class="flex flex-col">
      <div class="m-1">
        <label for="">Name: </label>
        <input
          type="text"
          class="border border-gray-300 rounded px-2 py-1"
          bind:value={pokerRange.name}
        />
      </div>
      <button
        class="bg-gray-300 hover:bg-gray-400 px-3 py-1 m-1 rounded"
        onclick={() => downloadRange()}>download</button
      >
    </div>
  </div>
</div>
