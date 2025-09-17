<script lang="ts">
  import { PokerRange } from "@utils/range.svelte";

  let {
    changeRanges,
    start,
  }: { changeRanges: (ranges: PokerRange[]) => void; start: () => void } =
    $props();

  const effectiveStacks = [15, 25, 40, 75, 100];
  let selectedEffectiveStacks: Number[] = $state([]);

  const positions = [
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
  let selectedPositions: String[] = $state([]);

  const actions = ["RFI", "vs UTG", "vs MP", "vs LP", "vs Blinds"];
  let selectedActions: String[] = $state([]);

  function selectStack(option: Number) {
    if (selectedEffectiveStacks.includes(option)) {
      selectedEffectiveStacks = selectedEffectiveStacks.filter(
        (item) => item !== option
      );
    } else {
      selectedEffectiveStacks.push(option);
    }
    addSelectedRangesToRanges();
  }

  function selectPosition(option: String) {
    if (selectedPositions.includes(option)) {
      selectedPositions = selectedPositions.filter((item) => item !== option);
    } else {
      selectedPositions.push(option);
    }
    addSelectedRangesToRanges();
  }

  function selectAction(option: String) {
    if (selectedActions.includes(option)) {
      selectedActions = selectedActions.filter((item) => item !== option);
    } else {
      selectedActions.push(option);
    }
    addSelectedRangesToRanges();
  }

  async function addSelectedRangesToRanges() {
    let ranges = [];
    for (const stack of selectedEffectiveStacks) {
      for (const position of selectedPositions) {
        for (const action of selectedActions) {
          const response = await fetch(
            `/ranges/mtt/${stack}/${action}/${position}.json`
          );

          if (response.ok) {
            const json = await response.json();
            console.log(json);
            ranges.push(PokerRange.fromJSON(json));
          }
        }
      }
    }

    console.log(ranges);
    changeRanges(ranges);
    start();
  }
</script>

<div class="flex flex-col">
  <div>
    <h2>Effective stack</h2>
    <div class="flex flex-wrap">
      {#each effectiveStacks as effectiveStack}
        <button
          class="p-2 border m-1 rounded text-center cursor-pointer {selectedEffectiveStacks.includes(
            effectiveStack
          )
            ? 'bg-blue-200 hover:bg-blue-300'
            : 'hover:bg-gray-200'}"
          onclick={() => selectStack(effectiveStack)}
        >
          {effectiveStack}bb
        </button>
      {/each}
    </div>
  </div>
  <div class="">
    <h2>Positions</h2>
    <div class="flex flex-wrap">
      {#each positions as position}
        <button
          class="p-2 border m-1 rounded text-center cursor-pointer hover:bg-gray-200 {selectedPositions.includes(
            position
          )
            ? 'bg-blue-200 hover:bg-blue-300'
            : 'hover:bg-gray-200'}"
          onclick={() => selectPosition(position)}
        >
          {position}
        </button>
      {/each}
    </div>
  </div>
  <div>
    <h2>Actions</h2>
    <div class="flex flex-wrap">
      {#each actions as action}
        <button
          class="p-2 border m-1 rounded text-center cursor-pointer hover:bg-gray-200 {selectedActions.includes(
            action
          )
            ? 'bg-blue-200 hover:bg-blue-300'
            : 'hover:bg-gray-200'}"
          onclick={() => selectAction(action)}
        >
          {action}
        </button>
      {/each}
    </div>
  </div>
</div>
