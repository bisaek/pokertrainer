<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
  import type { RangeInfo } from "@utils/manifest";
  import {
    blankGroup,
    exercisesIn,
    groupByCharts,
    type GroupDraft,
    type ItemDraft,
  } from "@utils/drill-draft";
  import DrillItems from "./drill-items.svelte";

  // The exercises of a drill being edited, and the groups that decide how
  // they are played. Exercises and groups can be selected and put in a new
  // group together.
  let {
    manifest,
    game,
    stack,
    exercises = $bindable(),
  }: {
    manifest: RangeInfo[];
    game: string;
    stack: number;
    exercises: ItemDraft[];
  } = $props();

  const selected = new SvelteSet<ItemDraft>();
  const collapsed = new SvelteSet<ItemDraft>();
  // The item ticked or unticked last, where a shift-click range starts.
  let anchor: ItemDraft | null = null;

  const numbers = $derived(
    new Map(exercisesIn(exercises).map((exercise, index) => [exercise, index + 1]))
  );

  // The selected items, in the order they are written. An item in a selected
  // group goes along with its group.
  function selection(): { list: ItemDraft[]; item: ItemDraft }[] {
    const found: { list: ItemDraft[]; item: ItemDraft }[] = [];
    const walk = (list: ItemDraft[]) => {
      for (const item of list) {
        if (selected.has(item)) found.push({ list, item });
        else if (item.kind === "group") walk(item.items);
      }
    };
    walk(exercises);
    return found;
  }

  // The new group takes the place of the first selected item.
  function groupSelected() {
    const found = selection();
    if (found.length === 0) return;
    const first = found[0];
    const at = first.list.indexOf(first.item);
    first.list.splice(at, 0, blankGroup());
    const group = first.list[at] as GroupDraft;
    for (const { list, item } of found) {
      list.splice(list.indexOf(item), 1);
      group.items.push(item);
    }
    selected.clear();
  }

  // Every item as it shows on the page: a group, then what's in it unless
  // it is collapsed.
  function shown(list: ItemDraft[]): ItemDraft[] {
    return list.flatMap((item) =>
      item.kind === "group" && !collapsed.has(item) ? [item, ...shown(item.items)] : [item]
    );
  }

  // With shift held, everything shown from the last item ticked to this one
  // is ticked or unticked with it, like in a file manager.
  function select(item: ItemDraft, on: boolean, range: boolean) {
    const list = shown(exercises);
    const from = range && anchor ? list.indexOf(anchor) : -1;
    const to = list.indexOf(item);
    const picked =
      from === -1 ? [item] : list.slice(Math.min(from, to), Math.max(from, to) + 1);
    for (const each of picked) {
      if (on) selected.add(each);
      else selected.delete(each);
    }
    anchor = item;
  }

  function groups(list: ItemDraft[]): ItemDraft[] {
    return list.flatMap((item) => (item.kind === "group" ? [item, ...groups(item.items)] : []));
  }

  function selectAll() {
    for (const item of exercises) selected.add(item);
  }
</script>

<div class="flex flex-col gap-3">
  <DrillItems
    items={exercises}
    outer={null}
    {numbers}
    {selected}
    onselect={select}
    {collapsed}
    {manifest}
    {game}
    {stack}
  />

  <!-- Tools for groups. "Group by charts" puts "rebuild these charts, then
       answer hands from them" together, which is the usual group. -->
  <div
    class="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-ink-700 bg-ink-900/95 p-2 text-sm backdrop-blur"
    data-group-tools
  >
    {#if selected.size > 0}
      <span class="px-1 font-medium">{selected.size} selected</span>
      <button class="btn btn-primary py-1" onclick={groupSelected}>Group them</button>
      <button class="btn btn-ghost py-1" onclick={() => selected.clear()}>Clear</button>
    {:else}
      <span class="px-1 muted">Tick exercises to group them, or</span>
      <button
        class="btn btn-secondary py-1"
        onclick={() => (exercises = groupByCharts(exercises, manifest, game, stack))}
        title="Put each Answer hands exercise in a group with the exercise before it, when they use the same charts"
        >Group by charts</button
      >
      <button class="btn btn-ghost py-1" onclick={selectAll}>Select all</button>
    {/if}
    {#if groups(exercises).length > 0}
      <span class="ml-auto flex gap-1">
        <button
          class="btn btn-ghost py-1"
          onclick={() => groups(exercises).forEach((group) => collapsed.add(group))}
          >Collapse groups</button
        >
        <button class="btn btn-ghost py-1" onclick={() => collapsed.clear()}>Expand all</button>
      </span>
    {/if}
  </div>
</div>
