<script lang="ts">
  import { PokerRange } from "@utils/range.svelte";

  let {
    changeRanges,
    start,
  }: { changeRanges: (ranges: PokerRange[]) => void; start: () => void } =
    $props();

  type RangeInfo = {
    game: string;
    stack: number;
    situation: string;
    position: string;
  };

  const games = [
    { id: "mtt", label: "MTT" },
    { id: "cash", label: "Cash" },
  ];
  const positionOrder = [
    "UTG",
    "UTG+1",
    "UTG+2",
    "LJ",
    "HJ",
    "CO",
    "BTN",
    "SB",
    "BB",
  ];
  const situationOrder = [
    "RFI",
    "vs UTG",
    "vs MP",
    "vs HJ",
    "vs CO",
    "vs BTN",
    "vs SB",
  ];

  let availableRanges: RangeInfo[] = $state([]);
  let selectedGame: string = $state("mtt");
  let selectedEffectiveStacks: number[] = $state([]);
  let selectedPositions: string[] = $state([]);
  let selectedActions: string[] = $state([]);
  let latestRequest = 0;

  const rangesForGame = $derived(
    availableRanges.filter((range) => range.game === selectedGame)
  );
  const effectiveStacks = $derived(
    [...new Set(rangesForGame.map((range) => range.stack))].sort(
      (a, b) => a - b
    )
  );
  const positions = $derived(
    positionOrder.filter((position) =>
      rangesForGame.some((range) => range.position === position)
    )
  );
  const actions = $derived(
    situationOrder.filter((situation) =>
      rangesForGame.some((range) => range.situation === situation)
    )
  );

  $effect(() => {
    fetch("/ranges/index.json")
      .then((response) => response.json())
      .then((json: RangeInfo[]) => (availableRanges = json));
  });

  function toggle<T>(list: T[], option: T): T[] {
    return list.includes(option)
      ? list.filter((item) => item !== option)
      : [...list, option];
  }

  function selectGame(game: string) {
    if (game === selectedGame) return;
    selectedGame = game;
    selectedEffectiveStacks = [];
    selectedPositions = [];
    selectedActions = [];
    addSelectedRangesToRanges();
  }

  function selectStack(option: number) {
    selectedEffectiveStacks = toggle(selectedEffectiveStacks, option);
    addSelectedRangesToRanges();
  }

  function selectPosition(option: string) {
    selectedPositions = toggle(selectedPositions, option);
    addSelectedRangesToRanges();
  }

  function selectAction(option: string) {
    selectedActions = toggle(selectedActions, option);
    addSelectedRangesToRanges();
  }

  async function addSelectedRangesToRanges() {
    const request = ++latestRequest;
    const matching = rangesForGame.filter(
      (range) =>
        selectedEffectiveStacks.includes(range.stack) &&
        selectedPositions.includes(range.position) &&
        selectedActions.includes(range.situation)
    );

    const ranges = await Promise.all(
      matching.map(async (range) => {
        const response = await fetch(
          `/ranges/${encodeURIComponent(range.game)}/${range.stack}/${encodeURIComponent(range.situation)}/${encodeURIComponent(range.position)}.json`
        );
        return PokerRange.fromJSON(await response.json());
      })
    );

    // Ignore results from an older click that finished after a newer one.
    if (request !== latestRequest) return;
    changeRanges(ranges);
    start();
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

<div class="flex flex-col">
  <div>
    <h2>Game</h2>
    <div class="flex flex-wrap">
      {#each games as game}
        {@render optionButton(game.label, selectedGame === game.id, () =>
          selectGame(game.id)
        )}
      {/each}
    </div>
  </div>
  <div>
    <h2>Effective stack</h2>
    <div class="flex flex-wrap">
      {#each effectiveStacks as effectiveStack}
        {@render optionButton(
          `${effectiveStack}bb`,
          selectedEffectiveStacks.includes(effectiveStack),
          () => selectStack(effectiveStack)
        )}
      {/each}
    </div>
  </div>
  <div>
    <h2>Positions</h2>
    <div class="flex flex-wrap">
      {#each positions as position}
        {@render optionButton(
          position,
          selectedPositions.includes(position),
          () => selectPosition(position)
        )}
      {/each}
    </div>
  </div>
  <div>
    <h2>Actions</h2>
    <div class="flex flex-wrap">
      {#each actions as action}
        {@render optionButton(action, selectedActions.includes(action), () =>
          selectAction(action)
        )}
      {/each}
    </div>
  </div>
</div>
