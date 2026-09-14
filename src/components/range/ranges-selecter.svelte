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
    type: string;
    opponent: string | null;
    position: string;
  };

  const gameLabels: Record<string, string> = { mtt: "MTT", cash: "Cash" };
  const positionOrder = [
    "UTG",
    "UTG+1",
    "UTG+2",
    "LJ",
    "MP",
    "HJ",
    "CO",
    "BTN",
    "SB",
    "BB",
  ];
  const typeOrder = [
    "RFI",
    "vs RFI",
    "vs all-in",
    "vs limp",
    "vs 3-bet",
    "vs 3-bet all-in",
    "vs 4-bet",
    "vs 4-bet all-in",
    "vs 5-bet",
    "vs 5-bet all-in",
    "vs 6-bet",
    "vs 6-bet all-in",
  ];

  let availableRanges: RangeInfo[] = $state([]);
  let selectedGame: string = $state("mtt");
  let selectedEffectiveStacks: number[] = $state([]);
  let selectedPositions: string[] = $state([]);
  let selectedTypes: string[] = $state([]);
  let selectedOpponents: string[] = $state([]);
  let latestRequest = 0;

  // Only show game types that have ranges.
  const games = $derived(
    [...new Set(availableRanges.map((range) => range.game))].map((id) => ({
      id,
      label: gameLabels[id] ?? id,
    }))
  );
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
  const types = $derived(
    typeOrder.filter((type) =>
      rangesForGame.some((range) => range.type === type)
    )
  );
  const opponents = $derived(
    positionOrder.filter((position) =>
      rangesForGame.some(
        (range) =>
          range.opponent === position && selectedTypes.includes(range.type)
      )
    )
  );

  $effect(() => {
    fetch("/ranges/index.json")
      .then((response) => response.json())
      .then((json: RangeInfo[]) => {
        availableRanges = json;
        if (!json.some((range) => range.game === selectedGame) && json[0]) {
          selectedGame = json[0].game;
        }
      });
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
    selectedTypes = [];
    selectedOpponents = [];
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

  function selectType(option: string) {
    selectedTypes = toggle(selectedTypes, option);
    addSelectedRangesToRanges();
  }

  function selectOpponent(option: string) {
    selectedOpponents = toggle(selectedOpponents, option);
    addSelectedRangesToRanges();
  }

  async function addSelectedRangesToRanges() {
    const request = ++latestRequest;
    const matching = rangesForGame.filter(
      (range) =>
        selectedEffectiveStacks.includes(range.stack) &&
        selectedPositions.includes(range.position) &&
        selectedTypes.includes(range.type) &&
        (range.opponent === null || selectedOpponents.includes(range.opponent))
    );

    const ranges = await Promise.all(
      matching.map(async (range) => {
        // encodeURI keeps "+" (as in UTG+1) literal; "%2B" isn't served.
        const response = await fetch(
          encodeURI(
            `/ranges/${range.game}/${range.stack}/${range.situation}/${range.position}.json`
          )
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
    <h2>Your position</h2>
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
    <h2>Situation</h2>
    <div class="flex flex-wrap">
      {#each types as type}
        {@render optionButton(type, selectedTypes.includes(type), () =>
          selectType(type)
        )}
      {/each}
    </div>
  </div>
  {#if opponents.length > 0}
    <div>
      <h2>Opponent</h2>
      <div class="flex flex-wrap">
        {#each opponents as opponent}
          {@render optionButton(
            opponent,
            selectedOpponents.includes(opponent),
            () => selectOpponent(opponent)
          )}
        {/each}
      </div>
    </div>
  {/if}
</div>
