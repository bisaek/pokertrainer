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
    loadCustomDrills,
    removeCustomDrill,
    type CustomDrill,
  } from "@utils/custom-drills";
  import {
    numberParam,
    onUrlChange,
    readParams,
    writeParams,
  } from "@utils/url-state";

  const gameLabels: Record<string, string> = { mtt: "MTT", cash: "Cash" };

  // The game, stack and open drill live in the URL (?game=cash&stack=100&drill=UTG+open)
  // so a copied link opens the same drill. A drill the player made is named by
  // its id instead (?custom=<id>), since its name may match a built-in one.
  const initial = readParams();

  let manifest: RangeInfo[] = $state.raw([]);
  let customDrills: CustomDrill[] = $state.raw([]);
  let selectedGame = $state(initial.get("game") ?? "cash");
  let selectedStack = $state(numberParam(initial, "stack") ?? 100);
  let drillName: string | null = $state(initial.get("drill"));
  let customId: string | null = $state(initial.get("custom"));

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
  // The player's own drills for this game and stack, resolved like the others.
  // A saved drill whose charts have gone is kept in the list so it can be
  // fixed or removed, but can't be opened.
  const ownDrills = $derived(
    customDrills
      .filter((item) => item.game === selectedGame && item.stack === selectedStack)
      .map((item) => ({
        id: item.id,
        drill: resolveDrill(item, manifest, selectedGame, selectedStack),
      }))
  );
  // A drill named in the URL that has no charts for this game and stack shows the list.
  const drill: Drill | null = $derived(
    customId !== null
      ? (ownDrills.find((item) => item.id === customId)?.drill ?? null)
      : (categories
          .flatMap((category) => category.drills)
          .find((item) => item.name === drillName) ?? null)
  );

  onMount(() => {
    customDrills = loadCustomDrills();
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
    customId = params.get("custom");
  }

  function writeUrl(mode: "replace" | "push" = "replace") {
    writeParams(
      { game: selectedGame, stack: selectedStack, drill: drillName, custom: customId },
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
    customId = null;
    writeUrl("push");
  }

  function openOwnDrill(id: string) {
    drillName = null;
    customId = id;
    writeUrl("push");
  }

  function deleteOwnDrill(item: CustomDrill) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    customDrills = removeCustomDrill(item.id);
  }

  // The editor opens on the game and stack shown here.
  const newDrillUrl = $derived(
    `/drills/new?${new URLSearchParams({ game: selectedGame, stack: String(selectedStack) })}`
  );
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

    <section class="flex flex-col gap-3" data-own-drills>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 class="section-title flex items-baseline gap-2">
          Your drills
          {#if ownDrills.length > 0}
            <span class="text-sm font-normal muted">{ownDrills.length}</span>
          {/if}
        </h2>
        <a href={newDrillUrl} class="btn btn-secondary ml-auto">+ Create a drill</a>
      </div>
      {#if ownDrills.length === 0}
        <p class="text-sm muted">
          Put together your own drill from any of the charts, for this game and stack.
        </p>
      {:else}
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {#each ownDrills as own (own.id)}
            {@const saved = customDrills.find((item) => item.id === own.id)!}
            <div class="card card-interactive flex flex-col gap-1.5 p-0 sm:p-0">
              <button
                class="flex flex-1 flex-col gap-1.5 p-4 text-left sm:p-5 sm:pb-2 disabled:cursor-not-allowed"
                onclick={() => openOwnDrill(own.id)}
                disabled={own.drill === null}
              >
                <span class="font-semibold text-ink-100">{saved.name}</span>
                {#if saved.description}
                  <span class="text-sm text-ink-300">{saved.description}</span>
                {/if}
                <span class="mt-1 text-xs muted">
                  {#if own.drill}
                    {own.drill.chartCount}
                    {own.drill.chartCount === 1 ? "chart" : "charts"} · {own.drill.exercises
                      .map(describeExercise)
                      .join(", then ")}
                  {:else}
                    None of its charts exist any more.
                  {/if}
                </span>
              </button>
              <div class="flex gap-1 px-2 pb-2">
                <a href="/drills/new?edit={encodeURIComponent(own.id)}" class="btn btn-ghost py-1">Edit</a>
                <button class="btn btn-ghost py-1" onclick={() => deleteOwnDrill(saved)}>Delete</button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>

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
