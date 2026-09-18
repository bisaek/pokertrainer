<script lang="ts">
  import { display, displayLabels, loadDisplay, toggleDisplay, type DisplayOption } from "@utils/display.svelte";

  // Hiding the table hides what it holds, so those options come along with it.
  const options: DisplayOption[] = ["table", "foldedSeats", "bets"];

  $effect(() => loadDisplay());
</script>

<div class="flex flex-col gap-2">
  <span class="label">Show</span>
  <div class="flex flex-wrap gap-2">
    {#each options as option}
      <button
        type="button"
        class="chip {display[option] ? 'chip-active' : ''}"
        aria-pressed={display[option]}
        disabled={option !== "table" && !display.table}
        onclick={() => toggleDisplay(option)}
      >
        {displayLabels[option]}
      </button>
    {/each}
  </div>
</div>

<style>
  .chip:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
