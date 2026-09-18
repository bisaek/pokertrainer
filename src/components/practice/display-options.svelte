<script lang="ts">
  import { onMount } from "svelte";
  import {
    display,
    loadDisplay,
    saveDisplay,
    type DisplayOption,
  } from "@utils/display.svelte";

  let open = $state(false);
  let root: HTMLDetailsElement | undefined = $state();

  onMount(loadDisplay);

  // Clicking anywhere else closes the menu, like a native dropdown.
  function windowClick(event: MouseEvent) {
    if (open && root && !root.contains(event.target as Node)) open = false;
  }

  const groups: { label: string; options: { key: DisplayOption; label: string }[] }[] = [
    {
      label: "Around the hand",
      options: [
        { key: "board", label: "Board" },
        { key: "chartName", label: "Chart name" },
        { key: "handName", label: "Hand name" },
        { key: "handsLeft", label: "Hands left" },
        { key: "keyHints", label: "Key hints" },
      ],
    },
    {
      label: "Chart",
      options: [
        { key: "idleChart", label: "While waiting" },
        { key: "mistakeChart", label: "After a mistake" },
      ],
    },
  ];
</script>

<svelte:window onclick={windowClick} />

<details class="relative" bind:open bind:this={root}>
  <summary class="chip cursor-pointer list-none [&::-webkit-details-marker]:hidden">
    Show <span aria-hidden="true" class="text-xs">▾</span>
  </summary>
  <div class="card absolute right-0 bottom-full z-10 mb-2 flex w-max flex-col gap-3 p-3 shadow-lg sm:p-3">
    {#each groups as group}
      <div class="flex flex-col gap-1.5">
        <span class="label">{group.label}</span>
        {#each group.options as option}
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
    {/each}
  </div>
</details>
