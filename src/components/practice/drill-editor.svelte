<script lang="ts">
  import { onMount } from "svelte";
  import {
    fetchManifest,
    positionOrder,
    typeOrder,
    type RangeInfo,
  } from "@utils/manifest";
  import { resolveUrls, type ExerciseTemplate, type RangeFilter } from "@utils/drills";
  import {
    loadCustomDrills,
    newDrillId,
    saveCustomDrill,
    type CustomDrill,
  } from "@utils/custom-drills";
  import { readParams } from "@utils/url-state";

  // A form that makes a drill out of the charts on this site: pick a game and
  // stack, then add exercises that each pick charts by position, situation and
  // opponent. Opening /drills/new?edit=<id> changes a saved drill instead.
  const gameLabels: Record<string, string> = { mtt: "MTT", cash: "Cash" };

  // Each exercise picks charts; an empty list means every one.
  type ExerciseDraft = {
    kind: "range" | "hands";
    positions: string[];
    types: string[];
    opponents: string[];
    timesInARow: number;
    count: number;
  };

  const streaks = [1, 2, 3];

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
  const charts = $derived(
    manifest.filter((range) => range.game === game && range.stack === stack)
  );

  // What each exercise can still choose from, and how many charts it has.
  const details = $derived(
    exercises.map((exercise) => {
      const forTypes = charts.filter(
        (range) => exercise.types.length === 0 || exercise.types.includes(range.type)
      );
      const forPositions = forTypes.filter(
        (range) => exercise.positions.length === 0 || exercise.positions.includes(range.position)
      );
      return {
        types: typeOrder.filter((type) => charts.some((range) => range.type === type)),
        positions: positionOrder.filter((position) =>
          forTypes.some((range) => range.position === position)
        ),
        opponents: positionOrder.filter((position) =>
          forPositions.some((range) => range.opponent === position)
        ),
        chartCount: resolveUrls(filterOf(exercise), manifest, game, stack).length,
      };
    })
  );

  const errors = $derived.by(() => {
    const list: string[] = [];
    if (name.trim() === "") list.push("Give the drill a name.");
    if (exercises.length === 0) list.push("Add at least one exercise.");
    details.forEach((detail, index) => {
      if (detail.chartCount === 0) list.push(`Exercise ${index + 1} has no charts.`);
    });
    return list;
  });

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

  function blankExercise(kind: "range" | "hands"): ExerciseDraft {
    return { kind, positions: [], types: [], opponents: [], timesInARow: 1, count: 30 };
  }

  function draftOf(exercise: ExerciseTemplate): ExerciseDraft {
    return {
      kind: exercise.kind,
      positions: exercise.filter.positions ?? [],
      types: exercise.filter.types,
      opponents: exercise.filter.opponents ?? [],
      timesInARow: exercise.kind === "range" ? exercise.timesInARow : 1,
      count: exercise.kind === "hands" ? exercise.count : 30,
    };
  }

  function filterOf(exercise: ExerciseDraft): RangeFilter {
    return {
      types: exercise.types,
      positions: exercise.positions.length ? exercise.positions : undefined,
      opponents: exercise.opponents.length ? exercise.opponents : undefined,
    };
  }

  function templateOf(exercise: ExerciseDraft): ExerciseTemplate {
    const filter = filterOf(exercise);
    return exercise.kind === "range"
      ? { kind: "range", filter, timesInARow: exercise.timesInARow }
      : { kind: "hands", filter, count: clampCount(exercise.count) };
  }

  function clampCount(count: number) {
    return Math.min(200, Math.max(1, Math.round(count) || 1));
  }

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
    for (const exercise of exercises) {
      exercise.positions = [];
      exercise.types = [];
      exercise.opponents = [];
    }
  }

  function toggle(list: string[], item: string): string[] {
    return list.includes(item) ? list.filter((other) => other !== item) : [...list, item];
  }

  function addExercise(kind: "range" | "hands") {
    // A new exercise starts with the picks of the last one, since "rebuild
    // these charts, then answer hands from them" is the usual shape.
    const last = exercises.at(-1);
    exercises.push(
      last ? { ...blankExercise(kind), positions: [...last.positions], types: [...last.types], opponents: [...last.opponents] } : blankExercise(kind)
    );
  }

  function removeExercise(index: number) {
    exercises.splice(index, 1);
  }

  function move(index: number, by: number) {
    const target = index + by;
    if (target < 0 || target >= exercises.length) return;
    const [item] = exercises.splice(index, 1);
    exercises.splice(target, 0, item);
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
      {#each exercises as exercise, index (exercise)}
        {@const detail = details[index]}
        <div class="card flex flex-col gap-4" data-exercise>
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-semibold text-ink-100">Exercise {index + 1}</span>
            <span class="text-sm muted" data-chart-count>
              {detail.chartCount}
              {detail.chartCount === 1 ? "chart" : "charts"}
            </span>
            <div class="ml-auto flex items-center gap-1">
              <button class="btn btn-ghost py-1" onclick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">↑</button>
              <button class="btn btn-ghost py-1" onclick={() => move(index, 1)} disabled={index === exercises.length - 1} aria-label="Move down">↓</button>
              <button class="btn btn-ghost py-1" onclick={() => removeExercise(index)}>Remove</button>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <span class="label">What to do</span>
            <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="What to do">
              <button
                class="chip {exercise.kind === 'range' ? 'chip-active' : ''}"
                role="radio"
                aria-checked={exercise.kind === "range"}
                onclick={() => (exercise.kind = "range")}>Rebuild the charts</button
              >
              <button
                class="chip {exercise.kind === 'hands' ? 'chip-active' : ''}"
                role="radio"
                aria-checked={exercise.kind === "hands"}
                onclick={() => (exercise.kind = "hands")}>Answer hands</button
              >
            </div>
          </div>

          {#if exercise.kind === "range"}
            <div class="flex flex-col gap-1.5">
              <span class="label">Correct in a row to finish a chart</span>
              <div class="flex gap-1.5" role="radiogroup" aria-label="Correct in a row to finish a chart">
                {#each streaks as streak}
                  <button
                    class="chip {exercise.timesInARow === streak ? 'chip-active' : ''}"
                    role="radio"
                    aria-checked={exercise.timesInARow === streak}
                    onclick={() => (exercise.timesInARow = streak)}>{streak}</button
                  >
                {/each}
              </div>
            </div>
          {:else}
            <label class="flex flex-col gap-1.5">
              <span class="label">Hands to answer</span>
              <input
                class="input max-w-32"
                type="number"
                min="1"
                max="200"
                bind:value={exercise.count}
                onblur={() => (exercise.count = clampCount(exercise.count))}
              />
            </label>
          {/if}

          <div class="flex flex-col gap-1.5">
            <span class="label">
              Situation
              {#if exercise.types.length === 0}<span class="font-normal tracking-normal normal-case text-ink-600">(all)</span>{/if}
            </span>
            <div class="flex flex-wrap gap-1.5">
              {#each detail.types as type}
                <button
                  class="chip {exercise.types.includes(type) ? 'chip-active' : ''}"
                  onclick={() => (exercise.types = toggle(exercise.types, type))}>{type}</button
                >
              {/each}
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <span class="label">
              Your position
              {#if exercise.positions.length === 0}<span class="font-normal tracking-normal normal-case text-ink-600">(all)</span>{/if}
            </span>
            <div class="flex flex-wrap gap-1.5">
              {#each detail.positions as position}
                <button
                  class="chip {exercise.positions.includes(position) ? 'chip-active' : ''}"
                  onclick={() => (exercise.positions = toggle(exercise.positions, position))}>{position}</button
                >
              {/each}
            </div>
          </div>

          {#if detail.opponents.length > 0}
            <div class="flex flex-col gap-1.5">
              <span class="label">
                Opponent
                {#if exercise.opponents.length === 0}<span class="font-normal tracking-normal normal-case text-ink-600">(all)</span>{/if}
              </span>
              <div class="flex flex-wrap gap-1.5">
                {#each detail.opponents as opponent}
                  <button
                    class="chip {exercise.opponents.includes(opponent) ? 'chip-active' : ''}"
                    onclick={() => (exercise.opponents = toggle(exercise.opponents, opponent))}>{opponent}</button
                  >
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/each}

      <div class="flex flex-wrap gap-2">
        <button class="btn btn-secondary" onclick={() => addExercise("range")}>+ Rebuild charts</button>
        <button class="btn btn-secondary" onclick={() => addExercise("hands")}>+ Answer hands</button>
      </div>
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
