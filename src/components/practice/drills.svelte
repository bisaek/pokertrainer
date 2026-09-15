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
  <div class="page">
    <header class="flex flex-col gap-2">
      <span class="eyebrow">Learn</span>
      <h1 class="page-title">Drills</h1>
      <p class="page-lead">
        Short, focused practice for one spot at a time. Pick a game and stack to
        see the drills that have charts.
      </p>
    </header>

    <div class="card flex flex-wrap items-center gap-x-8 gap-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <span class="label mr-1">Game</span>
        {#each games as game}
          <button
            class="chip {game === selectedGame ? 'chip-active' : ''}"
            onclick={() => selectGame(game)}
          >
            {gameLabels[game] ?? game}
          </button>
        {/each}
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="label mr-1">Effective stack</span>
        {#each stacks as stack}
          <button
            class="chip {stack === selectedStack ? 'chip-active' : ''}"
            onclick={() => (selectedStack = stack)}
          >
            {stack}bb
          </button>
        {/each}
      </div>
    </div>

    {#each categories as category}
      <section class="flex flex-col gap-3">
        <h2 class="section-title flex items-baseline gap-2">
          {category.name}
          <span class="text-sm font-normal muted">{category.drills.length}</span>
        </h2>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {#each category.drills as item}
            <button
              class="card card-interactive flex flex-col gap-1.5"
              onclick={() => (drill = item)}
            >
              <span class="font-semibold text-ink-100">{item.name}</span>
              <span class="text-sm text-ink-300">{item.description}</span>
              <span class="mt-1 text-xs muted">
                {item.chartCount}
                {item.chartCount === 1 ? "chart" : "charts"} · {item.exercises
                  .map(describeExercise)
                  .join(", then ")}
              </span>
            </button>
          {/each}
        </div>
      </section>
    {/each}
  </div>
{/if}
