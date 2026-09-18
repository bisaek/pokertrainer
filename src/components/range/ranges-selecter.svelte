<script lang="ts">
  import { Action, PokerRange } from "@utils/range.svelte";
  import {
    emptyFilter,
    fetchChart,
    fetchManifest,
    matchesFilter,
    rangeUrl,
    type RangeFilterValue,
    type RangeInfo,
  } from "@utils/manifest";
  import { spotFromInfo } from "@utils/spot";
  import { numberListParam, readParams, writeParams } from "@utils/url-state";
  import RangeFilter from "./range-filter.svelte";

  let {
    changeRanges,
    start,
  }: { changeRanges: (ranges: PokerRange[]) => void; start: () => void } =
    $props();

  // The selection lives in the URL (?game=cash&stack=100&position=BTN&type=RFI)
  // so a copied link loads the same charts.
  const initial = readParams();
  const hasSelection = [...initial.keys()].some((key) => key !== "game");

  let availableRanges: RangeInfo[] = $state([]);
  let filter: RangeFilterValue = $state(filterFromParams(initial));
  let latestRequest = 0;

  $effect(() => {
    fetchManifest().then((json) => {
      availableRanges = json;
      if (!json.some((range) => range.game === filter.game) && json[0]) {
        filter = emptyFilter(json[0].game);
      } else if (hasSelection) {
        addSelectedRangesToRanges();
      }
    });
  });

  function filterFromParams(params: URLSearchParams): RangeFilterValue {
    return {
      game: params.get("game") ?? "mtt",
      stacks: numberListParam(params, "stack"),
      positions: params.getAll("position"),
      types: params.getAll("type"),
      opponents: params.getAll("opponent"),
    };
  }

  function filterChanged() {
    writeParams({
      game: filter.game,
      stack: filter.stacks.map(String),
      position: filter.positions,
      type: filter.types,
      opponent: filter.opponents,
    });
    addSelectedRangesToRanges();
  }

  async function addSelectedRangesToRanges() {
    const request = ++latestRequest;
    const matching = availableRanges.filter((range) =>
      matchesFilter(range, filter, false)
    );

    // A chart that fails to load is skipped rather than losing the whole selection.
    const loaded = await Promise.all(
      matching.map(async (range) => {
        try {
          return PokerRange.fromJSON(
            (await fetchChart(rangeUrl(range))) as { range: Action[]; name: string },
            spotFromInfo(range)
          );
        } catch (error) {
          console.error(error);
          return null;
        }
      })
    );
    const ranges = loaded.filter((range) => range !== null);

    // Ignore results from an older click that finished after a newer one.
    if (request !== latestRequest) return;
    changeRanges(ranges);
    start();
  }
</script>

<RangeFilter
  items={availableRanges}
  bind:value={filter}
  inline
  onchange={filterChanged}
/>
