<script lang="ts">
  import { onMount } from "svelte";
  import { display, loadDisplay, saveDisplay } from "@utils/display.svelte";

  let open = $state(false);
  let root: HTMLDetailsElement | undefined = $state();

  onMount(loadDisplay);

  // Clicking anywhere else closes the menu, like a native dropdown.
  function windowClick(event: MouseEvent) {
    if (open && root && !root.contains(event.target as Node)) open = false;
  }

  const options = [
    { key: "board", label: "Board" },
    { key: "idleChart", label: "Chart while waiting" },
  ] as const;
</script>

<svelte:window onclick={windowClick} />

<details class="relative" bind:open bind:this={root}>
  <summary class="chip cursor-pointer list-none [&::-webkit-details-marker]:hidden">
    Show <span aria-hidden="true" class="text-xs">▾</span>
  </summary>
  <div class="card absolute right-0 z-10 mt-2 flex w-max flex-col gap-2 p-3 shadow-lg sm:p-3">
    {#each options as option}
      <label class="flex cursor-pointer items-center gap-2 text-sm whitespace-nowrap">
        <input
          type="checkbox"
          class="accent-accent-500"
          bind:checked={display[option.key]}
          onchange={saveDisplay}
        />
        {option.label}
      </label>
    {/each}
  </div>
</details>
