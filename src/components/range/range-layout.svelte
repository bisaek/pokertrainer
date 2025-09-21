<script lang="ts">
  import type { Snippet } from "svelte";
  import {
    PokerRange,
    Action,
    Hand,
    HandStrings,
    PokerRangeLength,
    getButtonClass,
  } from "../../utils/range.svelte";

  import Range from "./range.svelte";

  let {
    pokerRange = new PokerRange(),
    compareTo = undefined,
    isCorrect = undefined,
    children,
  }: {
    pokerRange: PokerRange;
    compareTo?: PokerRange;
    isCorrect?: boolean;
    children: Snippet;
  } = $props();

  let selectedAction: Action = $state(Action.Fold);

  function keyPressed(e: KeyboardEvent) {
    if (e.key === "1") selectedAction = Action.Raise;
    else if (e.key === "2") selectedAction = Action.Call;
    else if (e.key === "3") selectedAction = Action.Fold;
    else if (e.key === "4") selectedAction = Action.AllIn;
  }

  function isCorrectClass() {
    if (isCorrect === undefined) return "";
    else if (isCorrect) return "ring-4 ring-offset-2 ring-green-300";
    else return "ring-4 ring-offset-2 ring-red-300";
  }
</script>

<svelte:window onkeypress={keyPressed} />

<div class="flex flex-row justify-center gap-8 h-auto">
  <div class="grid grid-cols-13 gap-1 h-200 w-200 my-auto {isCorrectClass()}">
    <Range {pokerRange} {selectedAction} {compareTo} />
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
      {@render children?.()}
    </div>
  </div>
</div>
