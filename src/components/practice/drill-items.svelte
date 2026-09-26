<script lang="ts">
  import type { SvelteSet } from "svelte/reactivity";
  import type { RangeInfo } from "@utils/manifest";
  import {
    blankExercise,
    blankGroup,
    copyPicks,
    exercisesIn,
    type ExerciseDraft,
    type GroupDraft,
    type ItemDraft,
  } from "@utils/drill-draft";
  import DrillItems from "./drill-items.svelte";
  import ExerciseCard from "./exercise-card.svelte";

  // A list of a drill's exercises and groups, the drill's own or a group's.
  // A group shows its rules and its own list, so groups can hold groups.
  let {
    items,
    outer,
    numbers,
    selected,
    onselect,
    collapsed,
    manifest,
    game,
    stack,
  }: {
    items: ItemDraft[];
    // The list the group of this one is in, and the group's place there;
    // null for the drill's own list.
    outer: { items: ItemDraft[]; index: number } | null;
    // Each exercise's place among all of the drill's, from 1.
    numbers: Map<ExerciseDraft, number>;
    selected: SvelteSet<ItemDraft>;
    onselect: (item: ItemDraft, on: boolean, range: boolean) => void;
    // Groups showing only their title row.
    collapsed: SvelteSet<ItemDraft>;
    manifest: RangeInfo[];
    game: string;
    stack: number;
  } = $props();

  function move(index: number, by: number) {
    const target = index + by;
    if (target < 0 || target >= items.length) return;
    const [item] = items.splice(index, 1);
    items.splice(target, 0, item);
  }

  // Into the end of the group right above it.
  function moveIn(index: number) {
    const group = items[index - 1];
    if (group?.kind !== "group") return;
    const [item] = items.splice(index, 1);
    group.items.push(item);
  }

  // Out of this group, to right after it.
  function moveOut(index: number) {
    if (!outer) return;
    const [item] = items.splice(index, 1);
    outer.items.splice(outer.index + 1, 0, item);
  }

  function remove(index: number) {
    selected.delete(items[index]);
    items.splice(index, 1);
  }

  // The group's parts take its place.
  function ungroup(index: number) {
    const group = items[index];
    if (group.kind !== "group") return;
    selected.delete(group);
    items.splice(index, 1, ...group.items);
  }

  function addExercise(kind: "range" | "hands") {
    // A new exercise starts with the picks of the last one, since "rebuild
    // these charts, then answer hands from them" is the usual shape.
    const last = exercisesIn(items).at(-1);
    items.push(
      last
        ? {
            ...blankExercise(kind),
            picks: copyPicks(last.picks),
            settings: structuredClone($state.snapshot(last.settings)),
          }
        : blankExercise(kind)
    );
  }

  // The rules and what's in a collapsed group, in a few words.
  function summary(group: GroupDraft): string {
    const count = exercisesIn(group.items).length;
    const rules = [
      group.shuffle ? "random order" : "in order",
      group.pick !== null ? `only ${group.pick} of ${group.items.length}` : "",
      group.repeat > 1 ? `${group.repeat} times` : "",
      group.redoMistakes ? "again after a mistake" : "",
    ].filter((rule) => rule !== "");
    return `${count} ${count === 1 ? "exercise" : "exercises"} · ${rules.join(", ")}`;
  }

  function clampPick(pick: number, parts: number) {
    return Math.min(Math.max(1, parts), Math.max(1, Math.round(pick) || 1));
  }
</script>

<div class="flex flex-col gap-3">
  {#each items as item, index (item)}
    {#snippet controls()}
      <button class="btn btn-ghost py-1" onclick={() => move(index, -1)} disabled={index === 0} aria-label="Move up" title="Move up">↑</button>
      <button class="btn btn-ghost py-1" onclick={() => move(index, 1)} disabled={index === items.length - 1} aria-label="Move down" title="Move down">↓</button>
      {#if outer}
        <button class="btn btn-ghost py-1" onclick={() => moveOut(index)} aria-label="Move out of the group" title="Move out of the group">←</button>
      {/if}
      {#if items[index - 1]?.kind === "group"}
        <button class="btn btn-ghost py-1" onclick={() => moveIn(index)} aria-label="Move into the group above" title="Move into the group above">→</button>
      {/if}
      {#if item.kind === "group"}
        <button class="btn btn-ghost py-1" onclick={() => ungroup(index)}>Ungroup</button>
      {/if}
      <button class="btn btn-ghost py-1" onclick={() => remove(index)}>Remove</button>
    {/snippet}

    {#if item.kind === "group"}
      {@const parts = item.items.length}
      {@const open = !collapsed.has(item)}
      <div
        class="flex flex-col gap-3 rounded-2xl border border-accent-500/30 bg-accent-500/[0.03] p-3 sm:p-4"
        data-group
      >
        <div class="flex flex-wrap items-center gap-2">
          <button
            class="btn btn-ghost -ml-1 w-7 px-0 py-1"
            onclick={() => (open ? collapsed.add(item) : collapsed.delete(item))}
            aria-expanded={open}
            aria-label={open ? "Collapse the group" : "Expand the group"}
            data-collapse
          >
            <span class="inline-block transition-transform {open ? 'rotate-90' : ''}" aria-hidden="true">▸</span>
          </button>
          <input
            type="checkbox"
            class="accent-accent-500"
            aria-label="Select"
            checked={selected.has(item)}
            onclick={(e) => onselect(item, e.currentTarget.checked, e.shiftKey)}
            data-select
          />
          <span class="font-semibold text-accent-300">Group</span>
          <input
            class="input w-40 py-1"
            bind:value={item.name}
            placeholder="Name (optional)"
            maxlength="40"
            aria-label="Group name"
          />
          <span class="text-sm muted">
            {open ? `${parts} ${parts === 1 ? "part" : "parts"}` : summary(item)}
          </span>
          <div class="ml-auto flex items-center gap-1">
            {@render controls()}
          </div>
        </div>

        {#if open}
          <!-- The group's rules; see GroupRules. -->
          <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm" data-group-rules>
            <label class="flex cursor-pointer items-center gap-2">
              <input type="checkbox" class="accent-accent-500" bind:checked={item.shuffle} data-rule="shuffle" />
              Play its parts in a random order
            </label>
            <label class="flex cursor-pointer items-center gap-2">
              <input type="checkbox" class="accent-accent-500" bind:checked={item.redoMistakes} data-rule="redo" />
              After a mistake in it, play it again at the end of {outer ? "the group it's in" : "the drill"}
            </label>
            <div class="flex flex-wrap items-center gap-2">
              <label class="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  class="accent-accent-500"
                  checked={item.pick !== null}
                  onchange={(e) =>
                    (item.pick = e.currentTarget.checked ? clampPick(parts - 1, parts) : null)}
                  data-rule="pick"
                />
                Only play
              </label>
              <input
                class="input w-16 py-1"
                type="number"
                min="1"
                max={Math.max(1, parts)}
                disabled={item.pick === null}
                value={item.pick ?? parts}
                onchange={(e) => (item.pick = clampPick(e.currentTarget.valueAsNumber, parts))}
                aria-label="How many parts to play"
              />
              <span class={item.pick === null ? "opacity-40" : ""}>of its parts, picked at random</span>
            </div>
            <label class="flex items-center gap-2">
              Play it
              <input
                class="input w-16 py-1"
                type="number"
                min="1"
                max="10"
                bind:value={item.repeat}
                onblur={() => (item.repeat = Math.min(10, Math.max(1, Math.round(item.repeat) || 1)))}
                data-rule="repeat"
              />
              {item.repeat === 1 ? "time" : "times"}
            </label>
          </div>

          <div class="border-l-2 border-accent-500/20 pl-3">
            <DrillItems
              items={item.items}
              outer={{ items, index }}
              {numbers}
              {selected}
              {onselect}
              {collapsed}
              {manifest}
              {game}
              {stack}
            />
          </div>
        {/if}
      </div>
    {:else}
      <ExerciseCard
        exercise={item}
        number={numbers.get(item) ?? 0}
        {manifest}
        {game}
        {stack}
        {selected}
        {onselect}
        {collapsed}
      >
        {@render controls()}
      </ExerciseCard>
    {/if}
  {/each}

  <div class="flex flex-wrap gap-2">
    <button class="btn btn-secondary" onclick={() => addExercise("range")}>+ Rebuild charts</button>
    <button class="btn btn-secondary" onclick={() => addExercise("hands")}>+ Answer hands</button>
    <button class="btn btn-secondary" onclick={() => items.push(blankGroup())}>+ Group</button>
  </div>
</div>
