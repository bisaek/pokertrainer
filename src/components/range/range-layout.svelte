<script lang="ts">
  import type { Snippet } from "svelte";
  import {
    PokerRange,
    Action,
    getButtonClass,
  } from "../../utils/range.svelte";

  import Range from "./range.svelte";
  import SpotTable from "@components/game/spot-table.svelte";
  import SpotToggle from "@components/game/spot-toggle.svelte";
  import { spotFor } from "@utils/table";
  import { tableView } from "@utils/table-view.svelte";

  let {
    pokerRange = new PokerRange(),
    compareTo = undefined,
    isCorrect = undefined,
    spotRange = undefined,
    actions = undefined,
    children = undefined,
  }: {
    pokerRange: PokerRange;
    compareTo?: PokerRange;
    isCorrect?: boolean;
    // The chart being rebuilt, so the spot can be shown as a table.
    spotRange?: PokerRange;
    // What to do with the chart, kept in view; anything else scrolls under it.
    actions?: Snippet;
    children?: Snippet;
  } = $props();

  let selectedAction: Action = $state(Action.Fold);

  // With the table open the chart shares the width with it rather than shrinking
  // to fit both on top of each other.
  const withTable = $derived(tableView.shown && spotFor(spotRange) !== null);

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

<!-- select-none: dragging to paint cells shouldn't highlight text. -->
<div
  class="grid items-start gap-6 select-none lg:min-h-0 lg:flex-1 lg:items-stretch {withTable
    ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_19rem]'
    : 'lg:grid-cols-[minmax(0,1fr)_19rem]'}"
>
  <div
    class="mx-auto flex w-full max-w-[46rem] items-start justify-center lg:min-h-0 lg:[container-type:size]"
  >
    <div class="w-full lg:w-[min(100cqw,100cqh)]">
      <div class="range-grid {isCorrectClass()}">
        <Range {pokerRange} {selectedAction} {compareTo} />
      </div>
    </div>
  </div>
  {#if withTable}
    <div
      class="flex items-start justify-center lg:min-h-0 lg:[container-type:size]"
    >
      <!-- 150cqh keeps the schematic's 3:2 inside the height it has. -->
      <div class="w-full lg:w-[min(100cqw,150cqh)]">
        <SpotTable range={spotRange} shape="compact" />
      </div>
    </div>
  {/if}
  <aside class="card flex flex-col gap-5 lg:min-h-0">
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
      <SpotToggle range={spotRange} class="-ml-3 self-start" />
    </div>
    {#if actions}
      <div
        class="max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:border-t max-lg:border-ink-700 max-lg:bg-ink-950/95 max-lg:px-4 max-lg:py-3 max-lg:backdrop-blur"
      >
        {@render actions()}
      </div>
    {/if}
    {#if children}
      <div class="flex flex-col gap-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {@render children()}
      </div>
    {/if}
  </aside>
</div>
