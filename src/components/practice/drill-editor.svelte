<script lang="ts">
  import { onMount } from "svelte";
  import { fetchManifest, type RangeInfo } from "@utils/manifest";
  import {
    loadCustomDrills,
    newDrillId,
    saveCustomDrill,
    type CustomDrill,
  } from "@utils/custom-drills";
  import {
    blankExercise,
    blankPick,
    draftOf,
    exerciseErrors,
    templateOf,
    type ExerciseDraft,
  } from "@utils/drill-draft";
  import { readParams } from "@utils/url-state";
  import DrillExercises from "./drill-exercises.svelte";

  // A form that makes a drill out of the charts on this site: pick a game and
  // stack, then add exercises that each pick charts by position, situation and
  // opponent. Opening /drills/new?edit=<id> changes a saved drill instead.
  const gameLabels: Record<string, string> = { mtt: "MTT", cash: "Cash" };

  let manifest: RangeInfo[] = $state.raw([]);
  let loaded = $state(false);
  let editId: string | null = $state(null);
  let name = $state("");
  let description = $state("");
  let game = $state("cash");
  let stack = $state(100);
  let exercises: ExerciseDraft[] = $state([blankExercise("range")]);
  let showErrors = $state(false);

  const games = $derived([...new Set(manifest.map((range) => range.game))]);
  const stacks = $derived(
    [...new Set(manifest.filter((range) => range.game === game).map((range) => range.stack))].sort(
      (a, b) => a - b
    )
  );

  const errors = $derived([
    ...(name.trim() === "" ? ["Give the drill a name."] : []),
    ...exerciseErrors(exercises, manifest, game, stack),
  ]);

  onMount(async () => {
    const json = await fetchManifest();
    manifest = json;
    const params = readParams();
    const saved = loadCustomDrills().find((drill) => drill.id === params.get("edit"));
    if (saved) {
      editId = saved.id;
      name = saved.name;
      description = saved.description;
      game = saved.game;
      stack = saved.stack;
      exercises = saved.exercises.map(draftOf);
    } else {
      // Start from the game and stack the drills page was showing.
      const wanted = params.get("game");
      const wantedStack = Number(params.get("stack"));
      game = json.some((range) => range.game === wanted) ? wanted! : (json[0]?.game ?? game);
      const available = json.filter((range) => range.game === game).map((range) => range.stack);
      stack = available.includes(wantedStack) ? wantedStack : Math.max(...available, 0);
    }
    loaded = true;
  });

  function selectGame(next: string) {
    if (next === game) return;
    game = next;
    const available = manifest.filter((range) => range.game === game).map((range) => range.stack);
    if (!available.includes(stack)) stack = Math.max(...available, 0);
    clearPicks();
  }

  function selectStack(next: number) {
    stack = next;
    clearPicks();
  }

  // Another game or stack has other charts, so the picks start over.
  function clearPicks() {
    for (const exercise of exercises) exercise.picks = [blankPick()];
  }

  function save() {
    if (errors.length > 0) {
      showErrors = true;
      return;
    }
    const drill: CustomDrill = {
      id: editId ?? newDrillId(),
      name: name.trim(),
      description: description.trim(),
      game,
      stack,
      exercises: exercises.map(templateOf),
    };
    saveCustomDrill(drill);
    const params = new URLSearchParams({ game, stack: String(stack), custom: drill.id });
    window.location.href = `/drills?${params}`;
  }
</script>

<div class="page page-narrow">
  <header class="flex flex-col gap-2">
    <a href="/drills" class="btn btn-ghost -ml-3 self-start">
      <span aria-hidden="true">←</span>
      Back to drills
    </a>
    <span class="eyebrow">Learn</span>
    <h1 class="page-title">{editId ? "Edit drill" : "Create a drill"}</h1>
    <p class="page-lead">
      Pick the charts to practice and how. The drill is kept in this browser and
      shows up under "Your drills".
    </p>
  </header>

  {#if !loaded}
    <p class="py-12 text-center muted">Loading…</p>
  {:else}
    <section class="card flex flex-col gap-4">
      <label class="flex flex-col gap-1.5">
        <span class="label">Name</span>
        <input class="input" bind:value={name} placeholder="BTN and CO opens" maxlength="60" />
      </label>
      <label class="flex flex-col gap-1.5">
        <span class="label">Description <span class="font-normal normal-case tracking-normal text-ink-600">(optional)</span></span>
        <input class="input" bind:value={description} placeholder="Late position opens, then a quiz." maxlength="120" />
      </label>
      <div class="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="label mr-1">Game</span>
          {#each games as item}
            <button class="chip {item === game ? 'chip-active' : ''}" onclick={() => selectGame(item)}>
              {gameLabels[item] ?? item}
            </button>
          {/each}
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="label mr-1">Effective stack</span>
          {#each stacks as item}
            <button class="chip {item === stack ? 'chip-active' : ''}" onclick={() => selectStack(item)}>
              {item}bb
            </button>
          {/each}
        </div>
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="section-title">Exercises</h2>
      <DrillExercises {manifest} {game} {stack} bind:exercises />
    </section>

    {#if showErrors && errors.length > 0}
      <ul class="card flex flex-col gap-1 border-red-500/40 text-sm text-red-300" data-errors>
        {#each errors as error}
          <li>{error}</li>
        {/each}
      </ul>
    {/if}

    <div class="flex flex-wrap gap-2">
      <button class="btn btn-primary btn-lg" onclick={save}>
        {editId ? "Save changes" : "Save drill"}
      </button>
      <a href="/drills" class="btn btn-ghost btn-lg">Cancel</a>
    </div>
  {/if}
</div>
