<script lang="ts">
  import type { Snippet } from "svelte";
  import {
    PokerRange,
    Action,
    getButtonClass,
  } from "../../utils/range.svelte";

  import type { Spot } from "../../utils/spot";
  import PokerTable from "../table/poker-table.svelte";
  import DisplayOptions from "../table/display-options.svelte";
  import { display } from "../../utils/display.svelte";
  import Range from "./range.svelte";

  let {
    pokerRange = new PokerRange(),
    compareTo = undefined,
    isCorrect = undefined,
    spot = undefined,
    children,
  }: {
    pokerRange: PokerRange;
    compareTo?: PokerRange;
    isCorrect?: boolean;
    // The situation being rebuilt, drawn as a table above the controls.
    spot?: Spot | null;
    children: Snippet;
  } = $props();

  let selectedAction: Action = $state(Action.Fold);
  // Height of the row on a wide screen; the grid is a square of that size.
  let rowHeight = $state(0);

  function keyPressed(e: KeyboardEvent) {
    // Typing in a field (like a range name) shouldn't switch the action.
    const target = e.target as HTMLElement | null;
    if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
    if (e.key === "1") selectedAction = Action.Raise;
    else if (e.key === "2") selectedAction = Action.Call;
    else if (e.key === "3") selectedAction = Action.Fold;
    else if (e.key === "4") selectedAction = Action.AllIn;
  }

  function isCorrectClass() {
    if (isCorrect === undefined) return "";
    return isCorrect ? "range-grid-correct" : "range-grid-wrong";
  }
</script>

<svelte:window onkeypress={keyPressed} />

<!-- select-none: dragging to paint cells shouldn't highlight text.
     On a wide screen the row takes the height that is left on the page (see
     .page-fill): the grid's column is as wide as the row is tall, so the grid
     is a square that fills it, the sidebar sits right next to it and the pair
     is centred. The sidebar scrolls on its own if it is what doesn't fit. -->
<div
  class="grid min-h-0 flex-1 gap-6 select-none lg:grid-cols-[min(var(--chart),60%)_minmax(22rem,30rem)] lg:grid-rows-[minmax(0,1fr)] lg:justify-center"
  style:--chart="{rowHeight}px"
  bind:clientHeight={rowHeight}
>
  <div class="range-frame mx-auto max-w-[46rem] lg:max-w-none">
    <div class="range-grid {isCorrectClass()}">
      <Range {pokerRange} {selectedAction} {compareTo} />
    </div>
  </div>
  <aside class="card flex min-h-0 flex-col gap-5 lg:max-h-full lg:self-start lg:overflow-y-auto">
    {#if spot && display.table}
      <PokerTable {spot} />
    {/if}
    {#if spot}
      <DisplayOptions />
    {/if}
    <div class="flex flex-col gap-2">
      <span class="label">Paint with</span>
      <div class="grid grid-cols-2 gap-2">
        {#each Object.values(Action) as action, index}
          <button
            class="action-option {getButtonClass(action)} {selectedAction === action
              ? 'action-option-selected'
              : ''}"
            onclick={() => (selectedAction = action)}
          >
            {action}
            <span class="kbd" aria-hidden="true">{index + 1}</span>
          </button>
        {/each}
      </div>
      <p class="text-xs muted">
        Drag across cells to paint. Hold Shift for a line or Ctrl for a box.
      </p>
    </div>
    {@render children?.()}
  </aside>
</div>
