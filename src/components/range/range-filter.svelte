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
    inline = false,
    onchange = undefined,
  }: {
    // What can be filtered; only options that some item has are shown.
    items: FilterItem[];
    value: RangeFilterValue;
    // Treat a row with nothing selected as everything, and say so.
    emptyMeansAll?: boolean;
    // Lay the groups out as a wrapping bar instead of stacking them.
    inline?: boolean;
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

  type Option = { label: string; selected: boolean; pick: () => void };
  type Group = { label: string; all: boolean; options: Option[] };

  function multi<T>(
    label: string,
    choices: T[],
    selected: T[],
    set: (picked: T[]) => Partial<RangeFilterValue>,
    name: (choice: T) => string = String
  ): Group {
    return {
      label,
      all: emptyMeansAll && selected.length === 0,
      options: choices.map((choice) => ({
        label: name(choice),
        selected: selected.includes(choice),
        pick: () => update(set(toggle(selected, choice))),
      })),
    };
  }

  // A group with nothing to choose from, like opponents for an open, is left out.
  const groups: Group[] = $derived(
    [
      {
        label: "Game",
        all: false,
        options: games.map((game) => ({
          label: gameLabels[game] ?? game,
          selected: value.game === game,
          pick: () => selectGame(game),
        })),
      },
      multi("Effective stack", stacks, value.stacks, (stacks) => ({ stacks }), (stack) => `${stack}bb`),
      multi("Your position", positions, value.positions, (positions) => ({ positions })),
      multi("Situation", types, value.types, (types) => ({ types })),
      multi("Opponent", opponents, value.opponents, (opponents) => ({ opponents })),
    ].filter((group) => group.options.length > 0)
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

<div class="flex {inline ? 'flex-wrap gap-x-6 gap-y-2' : 'flex-col gap-4'}">
  {#each groups as group (group.label)}
    <div class="flex {inline ? 'flex-wrap items-center gap-x-2 gap-y-1.5' : 'flex-col gap-2'}">
      <h3 class="label flex items-center gap-2">
        {group.label}
        {#if group.all}
          <span class="font-normal tracking-normal normal-case text-ink-600">(all)</span>
        {/if}
      </h3>
      <div class="flex flex-wrap gap-1.5">
        {#each group.options as option (option.label)}
          <button class="chip {option.selected ? 'chip-active' : ''}" onclick={option.pick}>
            {option.label}
          </button>
        {/each}
      </div>
    </div>
  {/each}
</div>
