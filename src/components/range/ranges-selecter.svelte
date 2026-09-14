<script lang="ts">
  import { PokerRange } from "@utils/range.svelte";
  import {
    emptyFilter,
    fetchManifest,
    matchesFilter,
    rangeUrl,
    type RangeFilterValue,
    type RangeInfo,
  } from "@utils/manifest";
  import RangeFilter from "./range-filter.svelte";

  let {
    changeRanges,
    start,
  }: { changeRanges: (ranges: PokerRange[]) => void; start: () => void } =
    $props();

  let availableRanges: RangeInfo[] = $state([]);
  let filter: RangeFilterValue = $state(emptyFilter("mtt"));
  let latestRequest = 0;

  $effect(() => {
    fetchManifest().then((json) => {
      availableRanges = json;
      if (!json.some((range) => range.game === filter.game) && json[0]) {
        filter = emptyFilter(json[0].game);
      }
    });
  });

  async function addSelectedRangesToRanges() {
    const request = ++latestRequest;
    const matching = availableRanges.filter((range) =>
      matchesFilter(range, filter, false)
    );

    const ranges = await Promise.all(
      matching.map(async (range) => {
        const response = await fetch(rangeUrl(range));
        return PokerRange.fromJSON(await response.json());
      })
    );

    // Ignore results from an older click that finished after a newer one.
    if (request !== latestRequest) return;
    changeRanges(ranges);
    start();
  }
</script>

<RangeFilter
  items={availableRanges}
  bind:value={filter}
  onchange={addSelectedRangesToRanges}
/>
