<script lang="ts">
  import { positionOrder, typeOrder, type RangeInfo } from "@utils/manifest";
  import { resolveUrls, type RangeFilter } from "@utils/drills";

  let {
    manifest,
    game,
    stack,
    filter,
    onchange,
  }: {
    manifest: RangeInfo[];
    game: string;
    stack: number;
    filter: RangeFilter;
    onchange: (next: RangeFilter) => void;
  } = $props();

  const items = $derived(
    manifest.filter((range) => range.game === game && range.stack === stack)
  );
  const forTypes = $derived(items.filter((range) => filter.types.includes(range.type)));
  // Selected options stay visible even when no chart has them, so they can be removed.
  const types = $derived(
    typeOrder.filter(
      (type) => items.some((range) => range.type === type) || filter.types.includes(type)
    )
  );
  const positions = $derived(
    positionOrder.filter(
      (position) =>
        forTypes.some((range) => range.position === position) ||
        (filter.positions ?? []).includes(position)
    )
  );
  const opponents = $derived(
    positionOrder.filter(
      (position) =>
        forTypes.some((range) => range.opponent === position) ||
        (filter.opponents ?? []).includes(position)
    )
  );
  const matchCount = $derived(
    filter.types.length > 0 ? resolveUrls(filter, manifest, game, stack).length : 0
  );

  function toggle(list: string[] | undefined, value: string) {
    const current = list ?? [];
    return current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
  }

  function update(next: RangeFilter) {
    onchange({
      types: [...next.types],
      ...(next.positions?.length ? { positions: [...next.positions] } : {}),
      ...(next.opponents?.length ? { opponents: [...next.opponents] } : {}),
    });
  }

  // Changing situations drops positions and opponents that no longer have charts.
  function toggleType(type: string) {
    const nextTypes = toggle(filter.types, type);
    const available = items.filter((range) => nextTypes.includes(range.type));
    update({
      types: nextTypes,
      positions: (filter.positions ?? []).filter((position) =>
        available.some((range) => range.position === position)
      ),
      opponents: (filter.opponents ?? []).filter((opponent) =>
        available.some((range) => range.opponent === opponent)
      ),
    });
  }
</script>

{#snippet allNote(selected: string[] | undefined)}
  {#if !selected?.length}
    <span class="font-normal tracking-normal normal-case text-ink-600">(all)</span>
  {/if}
{/snippet}

<div class="flex flex-col gap-3">
  <div class="flex flex-col gap-2">
    <span class="label">Situation</span>
    <div class="flex flex-wrap gap-1.5">
      {#each types as type}
        <button
          type="button"
          class="chip {filter.types.includes(type) ? 'chip-active' : ''}"
          onclick={() => toggleType(type)}>{type}</button
        >
      {/each}
    </div>
  </div>
  {#if positions.length > 0}
    <div class="flex flex-col gap-2">
      <span class="label flex items-center gap-2">Your position {@render allNote(filter.positions)}</span>
      <div class="flex flex-wrap gap-1.5">
        {#each positions as position}
          <button
            type="button"
            class="chip {(filter.positions ?? []).includes(position) ? 'chip-active' : ''}"
            onclick={() => update({ ...filter, positions: toggle(filter.positions, position) })}
            >{position}</button
          >
        {/each}
      </div>
    </div>
  {/if}
  {#if opponents.length > 0}
    <div class="flex flex-col gap-2">
      <span class="label flex items-center gap-2">Opponent {@render allNote(filter.opponents)}</span>
      <div class="flex flex-wrap gap-1.5">
        {#each opponents as opponent}
          <button
            type="button"
            class="chip {(filter.opponents ?? []).includes(opponent) ? 'chip-active' : ''}"
            onclick={() => update({ ...filter, opponents: toggle(filter.opponents, opponent) })}
            >{opponent}</button
          >
        {/each}
      </div>
    </div>
  {/if}
  <p class="text-sm {matchCount > 0 ? 'muted' : 'text-red-300'}" data-match-count>
    {#if filter.types.length === 0}
      Pick at least one situation.
    {:else if matchCount > 0}
      {matchCount} {matchCount === 1 ? "chart matches" : "charts match"} at {stack}bb.
    {:else}
      No charts match at {stack}bb.
    {/if}
  </p>
</div>
