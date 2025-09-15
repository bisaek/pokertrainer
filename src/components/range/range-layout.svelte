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
    children,
  }: {
    pokerRange: PokerRange;
    compareTo?: PokerRange;
    children: Snippet;
  } = $props();

  let selectedAction: Action = $state(Action.Fold);
</script>

<div class="flex flex-row justify-center gap-8 h-auto">
  <div class="grid grid-cols-13 gap-1 h-200 w-200 my-auto">
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
