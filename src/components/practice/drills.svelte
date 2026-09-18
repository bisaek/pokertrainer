<script lang="ts">
  import { onMount } from "svelte";
  import DrillRunner from "./drill-runner.svelte";
  import { fetchManifest, type RangeInfo } from "@utils/manifest";
  import {
    describeExercise,
    drillCategories,
    resolveDrill,
    type Drill,
  } from "@utils/drills";
  import {
    numberParam,
    onUrlChange,
    readParams,
    writeParams,
  } from "@utils/url-state";

  const gameLabels: Record<string, string> = { mtt: "MTT", cash: "Cash" };

  // The game, stack and open drill live in the URL (?game=cash&stack=100&drill=UTG+open)
  // so a copied link opens the same drill.
  const initial = readParams();

  let manifest: RangeInfo[] = $state.raw([]);
  let selectedGame = $state(initial.get("game") ?? "cash");
  let selectedStack = $state(numberParam(initial, "stack") ?? 100);
  let drillName: string | null = $state(initial.get("drill"));

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
  // A drill named in the URL that has no charts for this game and stack shows the list.
  const drill: Drill | null = $derived(
    categories
      .flatMap((category) => category.drills)
      .find((item) => item.name === drillName) ?? null
  );

  onMount(() => {
    fetchManifest().then((json) => {
      manifest = json;
      const game = json.some((range) => range.game === selectedGame)
        ? selectedGame
        : (json[0]?.game ?? selectedGame);
      selectGame(game);
    });
    return onUrlChange(readUrl);
  });

  function readUrl() {
    const params = readParams();
    selectedGame = params.get("game") ?? selectedGame;
    selectedStack = numberParam(params, "stack") ?? selectedStack;
    drillName = params.get("drill");
  }

  function writeUrl(mode: "replace" | "push" = "replace") {
    writeParams(
      { game: selectedGame, stack: selectedStack, drill: drillName },
      mode
    );
  }

  function selectGame(game: string) {
    selectedGame = game;
    const available = manifest
      .filter((range) => range.game === game)
      .map((range) => range.stack);
    if (available.length > 0 && !available.includes(selectedStack)) {
      selectedStack = Math.max(...available);
    }
    writeUrl();
  }

  function selectStack(stack: number) {
    selectedStack = stack;
    writeUrl();
  }

  function openDrill(item: Drill | null) {
    drillName = item?.name ?? null;
    writeUrl("push");
  }
</script>

{#if drill}
  <DrillRunner
    {drill}
    backLabel="Back to drills"
    onback={() => openDrill(null)}
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
            onclick={() => selectStack(stack)}
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
              onclick={() => openDrill(item)}
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
