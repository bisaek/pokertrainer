<script lang="ts">
  import type { Snippet } from "svelte";
  import type { SvelteSet } from "svelte/reactivity";
  import { positionOrder, typeOrder, type RangeInfo } from "@utils/manifest";
  import { resolveUrls } from "@utils/drills";
  import {
    blankPick,
    chartCount,
    clampCount,
    filterOfPick,
    settingsOf,
    type ExerciseDraft,
    type ItemDraft,
  } from "@utils/drill-draft";
  import {
    exerciseGroups,
    type MistakeMode,
    type SettingKey,
  } from "@utils/settings.svelte";

  // One exercise of a drill being edited: it picks charts by situation,
  // position and opponent, says what to do with them, and can set the
  // trainer's options. The charts come from one game and stack.
  let {
    exercise,
    number,
    manifest,
    game,
    stack,
    selected,
    onselect,
    children,
  }: {
    exercise: ExerciseDraft;
    // Its place among all the drill's exercises, from 1.
    number: number;
    manifest: RangeInfo[];
    game: string;
    stack: number;
    selected: SvelteSet<ItemDraft>;
    // Ticked or unticked; with shift held, everything from the last one
    // ticked goes along.
    onselect: (item: ItemDraft, on: boolean, range: boolean) => void;
    // The buttons at the end of the title row.
    children: Snippet;
  } = $props();

  const mistakeModes: { value: MistakeMode; label: string }[] = [
    { value: "retry", label: "Try again" },
    { value: "move-on", label: "Move on" },
  ];
  const streaks = [1, 2, 3];

  const charts = $derived(
    manifest.filter((range) => range.game === game && range.stack === stack)
  );
  const types = $derived(typeOrder.filter((type) => charts.some((range) => range.type === type)));

  // What each pick can still choose from, and how many charts it and the
  // exercise have.
  const detail = $derived({
    chartCount: chartCount(exercise, manifest, game, stack),
    picks: exercise.picks.map((pick) => {
      const forTypes = charts.filter(
        (range) => pick.types.length === 0 || pick.types.includes(range.type)
      );
      const forPositions = forTypes.filter(
        (range) => pick.positions.length === 0 || pick.positions.includes(range.position)
      );
      return {
        positions: positionOrder.filter((position) =>
          forTypes.some((range) => range.position === position)
        ),
        opponents: positionOrder.filter((position) =>
          forPositions.some((range) => range.opponent === position)
        ),
        chartCount: resolveUrls(filterOfPick(pick), manifest, game, stack).length,
      };
    }),
  });

  // An option's rule for an exercise: unset, or on/off with a lock.
  function ruleOf(exercise: ExerciseDraft, key: SettingKey) {
    return exercise.settings[key] as { value: boolean; locked: boolean } | undefined;
  }

  function setRule(exercise: ExerciseDraft, key: SettingKey, value: boolean | null) {
    if (value === null) {
      delete exercise.settings[key];
    } else {
      (exercise.settings as Record<SettingKey, unknown>)[key] = {
        value,
        locked: ruleOf(exercise, key)?.locked ?? false,
      };
    }
  }

  function setLocked(exercise: ExerciseDraft, key: SettingKey, locked: boolean) {
    const rule = ruleOf(exercise, key);
    if (rule) rule.locked = locked;
  }

  function ruleCount(exercise: ExerciseDraft): number {
    return Object.keys(settingsOf(exercise) ?? {}).length;
  }

  function toggle(list: string[], item: string): string[] {
    return list.includes(item) ? list.filter((other) => other !== item) : [...list, item];
  }

  function addPick(exercise: ExerciseDraft) {
    exercise.picks.push(blankPick());
  }

  function removePick(exercise: ExerciseDraft, index: number) {
    exercise.picks.splice(index, 1);
  }
</script>

<div class="card flex flex-col gap-4" data-exercise>
  <div class="flex flex-wrap items-center gap-2">
    <input
      type="checkbox"
      class="accent-accent-500"
      aria-label="Select"
      checked={selected.has(exercise)}
      onclick={(e) => onselect(exercise, e.currentTarget.checked, e.shiftKey)}
      data-select
    />
    <span class="font-semibold text-ink-100">Exercise {number}</span>
    <span class="text-sm muted" data-chart-count>
      {detail.chartCount}
      {detail.chartCount === 1 ? "chart" : "charts"}
    </span>
    <div class="ml-auto flex items-center gap-1">
      {@render children()}
    </div>
  </div>

  <div class="flex flex-col gap-1.5">
    <span class="label">What to do</span>
    <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="What to do">
      <button
        class="chip {exercise.kind === 'range' ? 'chip-active' : ''}"
        role="radio"
        aria-checked={exercise.kind === "range"}
        onclick={() => (exercise.kind = "range")}>Rebuild the charts</button
      >
      <button
        class="chip {exercise.kind === 'hands' ? 'chip-active' : ''}"
        role="radio"
        aria-checked={exercise.kind === "hands"}
        onclick={() => (exercise.kind = "hands")}>Answer hands</button
      >
    </div>
  </div>

  {#if exercise.kind === "range"}
    <div class="flex flex-col gap-1.5">
      <span class="label">Correct in a row to finish a chart</span>
      <div class="flex gap-1.5" role="radiogroup" aria-label="Correct in a row to finish a chart">
        {#each streaks as streak}
          <button
            class="chip {exercise.timesInARow === streak ? 'chip-active' : ''}"
            role="radio"
            aria-checked={exercise.timesInARow === streak}
            onclick={() => (exercise.timesInARow = streak)}>{streak}</button
          >
        {/each}
      </div>
    </div>
  {:else}
    <label class="flex flex-col gap-1.5">
      <span class="label">Hands to answer</span>
      <input
        class="input max-w-32"
        type="number"
        min="1"
        max="200"
        bind:value={exercise.count}
        onblur={() => (exercise.count = clampCount(exercise.count))}
      />
    </label>
  {/if}

  <div class="flex flex-col gap-3">
    <span class="label">Charts</span>
    {#each exercise.picks as pick, pickIndex (pick)}
      {@const pickDetail = detail.picks[pickIndex]}
      <div
        class="flex flex-col gap-3 rounded-xl border border-ink-700 bg-ink-850/60 p-3"
        data-pick
      >
        {#if exercise.picks.length > 1}
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-ink-300">Charts {pickIndex + 1}</span>
            <span class="text-sm muted" data-pick-count>
              {pickDetail.chartCount}
              {pickDetail.chartCount === 1 ? "chart" : "charts"}
            </span>
            <button
              class="btn btn-ghost ml-auto py-1"
              onclick={() => removePick(exercise, pickIndex)}>Remove</button
            >
          </div>
        {/if}

        <div class="flex flex-col gap-1.5">
          <span class="label">
            Situation
            {#if pick.types.length === 0}<span class="font-normal tracking-normal normal-case text-ink-600">(all)</span>{/if}
          </span>
          <div class="flex flex-wrap gap-1.5">
            {#each types as type}
              <button
                class="chip {pick.types.includes(type) ? 'chip-active' : ''}"
                onclick={() => (pick.types = toggle(pick.types, type))}>{type}</button
              >
            {/each}
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="label">
            Your position
            {#if pick.positions.length === 0}<span class="font-normal tracking-normal normal-case text-ink-600">(all)</span>{/if}
          </span>
          <div class="flex flex-wrap gap-1.5">
            {#each pickDetail.positions as position}
              <button
                class="chip {pick.positions.includes(position) ? 'chip-active' : ''}"
                onclick={() => (pick.positions = toggle(pick.positions, position))}>{position}</button
              >
            {/each}
          </div>
        </div>

        {#if pickDetail.opponents.length > 0}
          <div class="flex flex-col gap-1.5">
            <span class="label">
              Opponent
              {#if pick.opponents.length === 0}<span class="font-normal tracking-normal normal-case text-ink-600">(all)</span>{/if}
            </span>
            <div class="flex flex-wrap gap-1.5">
              {#each pickDetail.opponents as opponent}
                <button
                  class="chip {pick.opponents.includes(opponent) ? 'chip-active' : ''}"
                  onclick={() => (pick.opponents = toggle(pick.opponents, opponent))}>{opponent}</button
                >
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/each}
    <!-- A second set of charts is for a mix that one set can't say,
         like every open plus the big blind's defense. -->
    <button class="btn btn-secondary self-start" onclick={() => addPick(exercise)}>
      + Add more charts
    </button>
  </div>

  <!-- What the trainer shows during this exercise. An option left as
       the player's choice follows their Options menu; one set here
       starts on or off, and locked, can't be changed in the menu. -->
  <details class="flex flex-col gap-3" data-exercise-options>
    <summary class="flex cursor-pointer items-center gap-2 select-none">
      <span class="label">Options</span>
      <span class="text-sm muted">
        {#if ruleCount(exercise) === 0}
          all the player's choice
        {:else}
          {ruleCount(exercise)} set
        {/if}
      </span>
    </summary>
    <div class="mt-3 flex flex-col gap-4">
      {#if exercise.kind === "hands"}
        <div class="flex flex-col gap-2">
          <span class="label">Rules</span>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span class="text-sm">After a mistake</span>
            <div class="flex gap-1.5" role="radiogroup" aria-label="After a mistake">
              {#each mistakeModes as mode}
                <button
                  class="chip {exercise.mistakes === mode.value ? 'chip-active' : ''}"
                  role="radio"
                  aria-checked={exercise.mistakes === mode.value}
                  onclick={() => (exercise.mistakes = mode.value)}>{mode.label}</button
                >
              {/each}
            </div>
          </div>
          <label class="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              class="accent-accent-500"
              bind:checked={exercise.repeatMistakes}
            />
            Wrong hands come back at the end
          </label>
        </div>
      {/if}
      {#each exerciseGroups(exercise.kind) as group (group.label)}
        <div class="flex flex-col gap-2">
          <span class="label">{group.label}</span>
          {#each group.toggles as toggle (toggle.key)}
            {@const rule = ruleOf(exercise, toggle.key)}
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5" data-option={toggle.key}>
              <span class="w-56 text-sm">{toggle.label}</span>
              <div class="flex gap-1.5" role="radiogroup" aria-label={toggle.label}>
                <button
                  class="chip {rule === undefined ? 'chip-active' : ''}"
                  role="radio"
                  aria-checked={rule === undefined}
                  onclick={() => setRule(exercise, toggle.key, null)}>Player's choice</button
                >
                <button
                  class="chip {rule?.value === true ? 'chip-active' : ''}"
                  role="radio"
                  aria-checked={rule?.value === true}
                  onclick={() => setRule(exercise, toggle.key, true)}>On</button
                >
                <button
                  class="chip {rule?.value === false ? 'chip-active' : ''}"
                  role="radio"
                  aria-checked={rule?.value === false}
                  onclick={() => setRule(exercise, toggle.key, false)}>Off</button
                >
              </div>
              <label
                class="flex items-center gap-2 text-sm whitespace-nowrap {rule
                  ? 'cursor-pointer'
                  : 'cursor-default opacity-40'}"
              >
                <input
                  type="checkbox"
                  class="accent-accent-500"
                  checked={rule?.locked ?? false}
                  disabled={rule === undefined}
                  onchange={(e) => setLocked(exercise, toggle.key, e.currentTarget.checked)}
                />
                Locked
              </label>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </details>
</div>
