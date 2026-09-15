<script lang="ts">
  import DrillRunner from "./drill-runner.svelte";
  import { fetchManifest, type RangeInfo } from "@utils/manifest";
  import {
    describeExercise,
    drillCategories,
    resolveDrill,
    type Drill,
  } from "@utils/drills";

  const gameLabels: Record<string, string> = { mtt: "MTT", cash: "Cash" };

  let manifest: RangeInfo[] = $state.raw([]);
  let selectedGame = $state("cash");
  let selectedStack = $state(100);
  let drill = $state<Drill | null>(null);

  const games = $derived([...new Set(manifest.map((range) => range.game))]);
  const stacks = $derived(
    [
      ...new Set(
        manifest
          .filter((range) => range.game === selectedGame)
          .map((range) => range.stack)
      ),
    ].sort((a, b) => a - b)
  );
  const categories = $derived(
    drillCategories
      .map((category) => ({
        name: category.name,
        drills: category.drills
          .map((drill) =>
            resolveDrill(drill, manifest, selectedGame, selectedStack)
          )
          .filter((drill) => drill !== null),
      }))
      .filter((category) => category.drills.length > 0)
  );

  $effect(() => {
    fetchManifest().then((json) => {
      manifest = json;
      const game = json.some((range) => range.game === selectedGame)
        ? selectedGame
        : (json[0]?.game ?? selectedGame);
      selectGame(game);
    });
  });

  function selectGame(game: string) {
    selectedGame = game;
    const available = manifest
      .filter((range) => range.game === game)
      .map((range) => range.stack);
    if (available.length > 0 && !available.includes(selectedStack)) {
      selectedStack = Math.max(...available);
    }
  }
</script>

{#if drill}
  <DrillRunner
    {drill}
    backLabel="Back to drills"
    onback={() => (drill = null)}
  />
{:else}
  <div class="p-4 flex flex-col gap-6">
    <div class="flex flex-wrap items-center gap-2">
      <h2 class="mr-1">Game</h2>
      {#each games as game}
        <button
          class="p-2 border rounded cursor-pointer {game === selectedGame
            ? 'bg-blue-200 hover:bg-blue-300'
            : 'hover:bg-gray-200'}"
          onclick={() => selectGame(game)}
        >
          {gameLabels[game] ?? game}
        </button>
      {/each}
      <h2 class="ml-6 mr-1">Effective stack</h2>
      {#each stacks as stack}
        <button
          class="p-2 border rounded cursor-pointer {stack === selectedStack
            ? 'bg-blue-200 hover:bg-blue-300'
            : 'hover:bg-gray-200'}"
          onclick={() => (selectedStack = stack)}
        >
          {stack}bb
        </button>
      {/each}
    </div>

    {#each categories as category}
      <section>
        <h2 class="text-2xl mb-2">{category.name}</h2>
        <div
          class="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {#each category.drills as item}
            <button
              class="text-left p-3 border rounded cursor-pointer hover:bg-gray-100"
              onclick={() => (drill = item)}
            >
              <div class="font-semibold">{item.name}</div>
              <div class="text-sm text-gray-600">{item.description}</div>
              <div class="text-xs text-gray-500 mt-1">
                {item.chartCount}
                {item.chartCount === 1 ? "chart" : "charts"} · {item.exercises
                  .map(describeExercise)
                  .join(", then ")}
              </div>
            </button>
          {/each}
        </div>
      </section>
    {/each}
  </div>
{/if}
