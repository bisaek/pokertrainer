<script lang="ts">
  import { onMount } from "svelte";
  import {
    aroundChartGroup,
    aroundHandGroup,
    chartGroup,
    drillLocks,
    handCounts,
    loadSettings,
    pageGroup,
    rangeStreaks,
    resetSettings,
    saveSettings,
    settings,
    tableGroup,
    type MistakeMode,
    type SettingKey,
    type ToggleGroup,
  } from "@utils/settings.svelte";

  let {
    trainer,
  }: {
    // Which trainer the menu is for: it decides which choices are offered.
    // A drill sets its own rules, so it only gets the display choices.
    trainer: "hand" | "range" | "drill";
  } = $props();

  let open = $state(false);
  let root: HTMLDetailsElement | undefined = $state();

  onMount(loadSettings);

  // Clicking anywhere else closes the menu, like a native dropdown.
  function windowClick(event: MouseEvent) {
    if (open && root && !root.contains(event.target as Node)) open = false;
  }

  function windowKeydown(event: KeyboardEvent) {
    if (open && event.key === "Escape") open = false;
  }

  const groups = $derived.by((): ToggleGroup[] => {
    if (trainer === "range") return [pageGroup, tableGroup, aroundChartGroup];
    if (trainer === "hand") return [pageGroup, tableGroup, aroundHandGroup, chartGroup];
    return [tableGroup, aroundHandGroup, chartGroup];
  });

  const mistakeModes: { value: MistakeMode; label: string }[] = [
    { value: "retry", label: "Try again" },
    { value: "move-on", label: "Move on" },
  ];

  function set<K extends SettingKey>(key: K, value: (typeof settings)[K]) {
    settings[key] = value;
    saveSettings();
  }

  function setToggle(key: SettingKey, checked: boolean) {
    (settings as Record<SettingKey, unknown>)[key] = checked;
    saveSettings();
  }
</script>

<svelte:window onclick={windowClick} onkeydown={windowKeydown} />

<details class="relative" bind:open bind:this={root} data-trainer-options>
  <summary class="btn btn-secondary list-none [&::-webkit-details-marker]:hidden">
    <span aria-hidden="true">⚙</span>
    Options
  </summary>
  <!-- The groups sit side by side: a training page hides what overflows it,
       so the menu is kept wide and short rather than tall. -->
  <div
    class="card absolute right-0 top-full z-20 mt-2 flex w-max max-w-[calc(100vw-2rem)] flex-wrap gap-x-8 gap-y-4 p-4 shadow-lg sm:p-4"
  >
    {#if trainer === "hand"}
      <div class="flex flex-col gap-3">
        <span class="label">Hand trainer</span>
        <div class="flex flex-col gap-1.5">
          <span class="text-sm">After a mistake</span>
          <div class="flex gap-1.5" role="radiogroup" aria-label="After a mistake">
            {#each mistakeModes as mode}
              <button
                class="chip {settings.handMistakes === mode.value ? 'chip-active' : ''}"
                role="radio"
                aria-checked={settings.handMistakes === mode.value}
                onclick={() => set("handMistakes", mode.value)}
              >
                {mode.label}
              </button>
            {/each}
          </div>
          <span class="text-xs muted">
            {settings.handMistakes === "retry"
              ? "The hand stays until you get it right."
              : "The next hand comes up; the chart marks the mistake."}
          </span>
        </div>
        <label class="flex cursor-pointer items-center gap-2 text-sm whitespace-nowrap">
          <input
            type="checkbox"
            class="accent-accent-500"
            checked={settings.handRepeat}
            onchange={(e) => set("handRepeat", e.currentTarget.checked)}
          />
          Wrong hands come back at the end
        </label>
        <div class="flex flex-col gap-1.5">
          <span class="text-sm">Hands per round</span>
          <div class="flex gap-1.5" role="radiogroup" aria-label="Hands per round">
            {#each handCounts as count}
              <button
                class="chip {settings.handCount === count ? 'chip-active' : ''}"
                role="radio"
                aria-checked={settings.handCount === count}
                onclick={() => set("handCount", count)}
              >
                {count === 0 ? "All" : count}
              </button>
            {/each}
          </div>
          <span class="text-xs muted">A shorter round favors hands at the edge of a region.</span>
        </div>
      </div>
    {:else if trainer === "range"}
      <div class="flex flex-col gap-3">
        <span class="label">Range trainer</span>
        <label class="flex cursor-pointer items-center gap-2 text-sm whitespace-nowrap">
          <input
            type="checkbox"
            class="accent-accent-500"
            checked={settings.rangeRepeat}
            onchange={(e) => set("rangeRepeat", e.currentTarget.checked)}
          />
          Wrong charts also come back at the end
        </label>
        <div class="flex flex-col gap-1.5">
          <span class="text-sm">Correct in a row to finish a chart</span>
          <div class="flex gap-1.5" role="radiogroup" aria-label="Correct in a row to finish a chart">
            {#each rangeStreaks as streak}
              <button
                class="chip {settings.rangeStreak === streak ? 'chip-active' : ''}"
                role="radio"
                aria-checked={settings.rangeStreak === streak}
                onclick={() => set("rangeStreak", streak)}
              >
                {streak}
              </button>
            {/each}
          </div>
        </div>
        <label class="flex cursor-pointer items-center gap-2 text-sm whitespace-nowrap">
          <input
            type="checkbox"
            class="accent-accent-500"
            checked={settings.rangeAnswer}
            onchange={(e) => set("rangeAnswer", e.currentTarget.checked)}
          />
          Outline the answer after a check
        </label>
      </div>
    {/if}

    {#each groups as group}
      <div class="flex flex-col gap-1.5">
        <span class="label">{group.label}</span>
        {#each group.toggles as toggle}
          {@const locked = drillLocks.keys.includes(toggle.key)}
          {@const off = locked || (toggle.needs !== undefined && !settings[toggle.needs])}
          <label
            class="flex items-center gap-2 text-sm whitespace-nowrap {off
              ? 'cursor-default opacity-40'
              : 'cursor-pointer'}"
          >
            <input
              type="checkbox"
              class="accent-accent-500"
              checked={settings[toggle.key] as boolean}
              disabled={off}
              onchange={(e) => setToggle(toggle.key, e.currentTarget.checked)}
            />
            {toggle.label}
            {#if locked}
              <span class="text-xs muted">Set by the drill</span>
            {:else if toggle.hint}
              <span class="text-xs muted">{toggle.hint}</span>
            {/if}
          </label>
        {/each}
      </div>
    {/each}

    <div class="flex w-full justify-end border-t border-ink-700 pt-3">
      <button class="btn btn-ghost -mr-2 py-1" onclick={resetSettings}>Reset to defaults</button>
    </div>
  </div>
</details>
