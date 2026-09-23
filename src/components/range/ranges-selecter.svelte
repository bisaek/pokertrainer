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
  // so a copied link loads the same charts. Each set of charts after the first
  // numbers its keys (&game2=cash&position2=BB&type2=vs+RFI).
  const initial = readParams();
  const hasSelection = [...initial.keys()].some((key) => !/^game\d*$/.test(key));

  let availableRanges: RangeInfo[] = $state([]);
  // One filter per set of charts, so a mix that one filter can't say, like
  // every open plus the big blind's defense, can be practiced together.
  let filters: RangeFilterValue[] = $state(filtersFromParams(initial));
  let latestRequest = 0;

  $effect(() => {
    fetchManifest().then((json) => {
      availableRanges = json;
      const games = new Set(json.map((range) => range.game));
      if (json[0] && filters.some((filter) => !games.has(filter.game))) {
        filters = filters.map((filter) =>
          games.has(filter.game) ? filter : emptyFilter(json[0].game)
        );
      }
      if (hasSelection) addSelectedRangesToRanges();
    });
  });

  function filtersFromParams(params: URLSearchParams): RangeFilterValue[] {
    const list = [filterFromParams(params, "", "mtt")];
    for (let index = 2; params.has(`game${index}`); index++) {
      list.push(filterFromParams(params, String(index), list[0].game));
    }
    return list;
  }

  function filterFromParams(
    params: URLSearchParams,
    suffix: string,
    defaultGame: string
  ): RangeFilterValue {
    return {
      game: params.get(`game${suffix}`) ?? defaultGame,
      stacks: numberListParam(params, `stack${suffix}`),
      positions: params.getAll(`position${suffix}`),
      types: params.getAll(`type${suffix}`),
      opponents: params.getAll(`opponent${suffix}`),
    };
  }

  function filterChanged() {
    writeParams(
      Object.fromEntries(
        filters.flatMap((filter, index) => {
          const suffix = index === 0 ? "" : String(index + 1);
          return [
            [`game${suffix}`, filter.game],
            [`stack${suffix}`, filter.stacks.map(String)],
            [`position${suffix}`, filter.positions],
            [`type${suffix}`, filter.types],
            [`opponent${suffix}`, filter.opponents],
          ];
        })
      )
    );
    addSelectedRangesToRanges();
  }

  // A new set starts in the game and stack of the last one, since the charts
  // being mixed usually share them.
  function addFilter() {
    const last = filters[filters.length - 1];
    filters.push({ ...emptyFilter(last.game), stacks: [...last.stacks] });
    filterChanged();
  }

  function removeFilter(index: number) {
    filters.splice(index, 1);
    filterChanged();
  }

  async function addSelectedRangesToRanges() {
    const request = ++latestRequest;
    const matching = availableRanges.filter((range) =>
      filters.some((filter) => matchesFilter(range, filter, false))
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

<div class="flex flex-col gap-3">
  {#each filters as _, index}
    {#if filters.length > 1}
      <div
        class="flex flex-col gap-2 rounded-xl border border-ink-700 bg-ink-850/60 p-3"
        data-pick
      >
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-ink-300">Charts {index + 1}</span>
          <button class="btn btn-ghost ml-auto py-1" onclick={() => removeFilter(index)}
            >Remove</button
          >
        </div>
        <RangeFilter
          items={availableRanges}
          bind:value={filters[index]}
          inline
          onchange={filterChanged}
        />
      </div>
    {:else}
      <RangeFilter
        items={availableRanges}
        bind:value={filters[index]}
        inline
        onchange={filterChanged}
      />
    {/if}
  {/each}
  <button class="btn btn-secondary self-start" onclick={addFilter}>
    + Add more charts
  </button>
</div>
