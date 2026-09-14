<script lang="ts">
  import {
    positionOrder,
    typeOrder,
    type FilterItem,
    type RangeFilterValue,
  } from "@utils/manifest";

  let {
    items,
    value = $bindable(),
    emptyMeansAll = false,
    onchange = undefined,
  }: {
    // What can be filtered; only options that some item has are shown.
    items: FilterItem[];
    value: RangeFilterValue;
    // Treat a row with nothing selected as everything, and say so.
    emptyMeansAll?: boolean;
    onchange?: () => void;
  } = $props();

  const gameLabels: Record<string, string> = { mtt: "MTT", cash: "Cash" };

  const games = $derived([...new Set(items.map((item) => item.game))]);
  const itemsForGame = $derived(items.filter((item) => item.game === value.game));
  const stacks = $derived(
    [
      ...new Set(
        itemsForGame
          .map((item) => item.stack)
          .filter((stack): stack is number => stack !== null)
      ),
    ].sort((a, b) => a - b)
  );
  const positions = $derived(
    positionOrder.filter((position) =>
      itemsForGame.some((item) => item.position === position)
    )
  );
  const types = $derived(
    typeOrder.filter((type) => itemsForGame.some((item) => item.type === type))
  );
  const opponents = $derived(
    positionOrder.filter((position) =>
      itemsForGame.some(
        (item) =>
          item.opponent === position &&
          ((emptyMeansAll && value.types.length === 0) ||
            (item.type !== null && value.types.includes(item.type)))
      )
    )
  );

  function update(next: Partial<RangeFilterValue>) {
    value = { ...value, ...next };
    onchange?.();
  }

  function toggle<T>(list: T[], option: T): T[] {
    return list.includes(option)
      ? list.filter((item) => item !== option)
      : [...list, option];
  }

  function selectGame(game: string) {
    if (game === value.game) return;
    update({ game, stacks: [], positions: [], types: [], opponents: [] });
  }
</script>

{#snippet optionButton(label: string, selected: boolean, onclick: () => void)}
  <button
    class="p-2 border m-1 rounded text-center cursor-pointer {selected
      ? 'bg-blue-200 hover:bg-blue-300'
      : 'hover:bg-gray-200'}"
    {onclick}
  >
    {label}
  </button>
{/snippet}

{#snippet heading(label: string, selected: unknown[])}
  <h2>
    {label}
    {#if emptyMeansAll && selected.length === 0}
      <span class="text-sm text-gray-500">(all)</span>
    {/if}
  </h2>
{/snippet}

<div class="flex flex-col">
  <div>
    <h2>Game</h2>
    <div class="flex flex-wrap">
      {#each games as game}
        {@render optionButton(gameLabels[game] ?? game, value.game === game, () =>
          selectGame(game)
        )}
      {/each}
    </div>
  </div>
  <div>
    {@render heading("Effective stack", value.stacks)}
    <div class="flex flex-wrap">
      {#each stacks as stack}
        {@render optionButton(`${stack}bb`, value.stacks.includes(stack), () =>
          update({ stacks: toggle(value.stacks, stack) })
        )}
      {/each}
    </div>
  </div>
  <div>
    {@render heading("Your position", value.positions)}
    <div class="flex flex-wrap">
      {#each positions as position}
        {@render optionButton(position, value.positions.includes(position), () =>
          update({ positions: toggle(value.positions, position) })
        )}
      {/each}
    </div>
  </div>
  <div>
    {@render heading("Situation", value.types)}
    <div class="flex flex-wrap">
      {#each types as type}
        {@render optionButton(type, value.types.includes(type), () =>
          update({ types: toggle(value.types, type) })
        )}
      {/each}
    </div>
  </div>
  {#if opponents.length > 0}
    <div>
      {@render heading("Opponent", value.opponents)}
      <div class="flex flex-wrap">
        {#each opponents as opponent}
          {@render optionButton(opponent, value.opponents.includes(opponent), () =>
            update({ opponents: toggle(value.opponents, opponent) })
          )}
        {/each}
      </div>
    </div>
  {/if}
</div>
