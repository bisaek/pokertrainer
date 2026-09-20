<script lang="ts">
  import { onMount } from "svelte";
  import {
    fetchManifest,
    positionOrder,
    typeOrder,
    type RangeInfo,
  } from "@utils/manifest";
  import {
    resolveUrls,
    type ChartPick,
    type ExerciseTemplate,
    type RangeFilter,
  } from "@utils/drills";
  import {
    loadCustomDrills,
    newDrillId,
    saveCustomDrill,
    type CustomDrill,
  } from "@utils/custom-drills";
  import { readParams } from "@utils/url-state";
  import {
    exerciseGroups,
    type ExerciseSettings,
    type MistakeMode,
    type SettingKey,
  } from "@utils/settings.svelte";

  // A form that makes a drill out of the charts on this site: pick a game and
  // stack, then add exercises that each pick charts by position, situation and
  // opponent. Opening /drills/new?edit=<id> changes a saved drill instead.
  const gameLabels: Record<string, string> = { mtt: "MTT", cash: "Cash" };

  // A set of charts: an empty list means every one.
  type PickDraft = { positions: string[]; types: string[]; opponents: string[] };
  // Each exercise takes the charts of one or more picks, so opens from every
  // seat and the big blind's defense can go in the same exercise.
  type ExerciseDraft = {
    kind: "range" | "hands";
    picks: PickDraft[];
    timesInARow: number;
    count: number;
    mistakes: MistakeMode;
    repeatMistakes: boolean;
    // What the exercise says about the display options; an option not in
    // here is the player's to set.
    settings: ExerciseSettings;
  };

  const mistakeModes: { value: MistakeMode; label: string }[] = [
    { value: "retry", label: "Try again" },
    { value: "move-on", label: "Move on" },
  ];

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

  const types = $derived(typeOrder.filter((type) => charts.some((range) => range.type === type)));

  // What each pick can still choose from, and how many charts it and its
  // exercise have.
  const details = $derived(
    exercises.map((exercise) => ({
      chartCount: resolveUrls(filterOf(exercise), manifest, game, stack).length,
      picks: exercise.picks.map((pick) => {
        const forTypes = charts.filter(
          (range) => pick.types.length === 0 || pick.types.includes(range.type)
        );
        const forPositions = forTypes.filter(
          (range) => pick.positions.length === 0 || pick.positions.includes(range.position)
        );
        return {
          positions: positionOrder.filter((position) =>
            forTypes.some((range) => range.position === position)
          ),
          opponents: positionOrder.filter((position) =>
            forPositions.some((range) => range.opponent === position)
          ),
          chartCount: resolveUrls(filterOfPick(pick), manifest, game, stack).length,
        };
      }),
    }))
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

  function blankPick(): PickDraft {
    return { positions: [], types: [], opponents: [] };
  }

  function blankExercise(kind: "range" | "hands"): ExerciseDraft {
    return {
      kind,
      picks: [blankPick()],
      timesInARow: 1,
      count: 30,
      mistakes: "retry",
      repeatMistakes: true,
      settings: {},
    };
  }

  function draftOf(exercise: ExerciseTemplate): ExerciseDraft {
    const filters = Array.isArray(exercise.filter) ? exercise.filter : [exercise.filter];
    return {
      kind: exercise.kind,
      picks: filters.map((filter) => ({
        positions: filter.positions ?? [],
        types: filter.types,
        opponents: filter.opponents ?? [],
      })),
      timesInARow: exercise.kind === "range" ? exercise.timesInARow : 1,
      count: exercise.kind === "hands" ? exercise.count : 30,
      mistakes: (exercise.kind === "hands" && exercise.mistakes) || "retry",
      repeatMistakes: exercise.kind === "hands" ? (exercise.repeatMistakes ?? true) : true,
      settings: structuredClone(exercise.settings ?? {}),
    };
  }

  // An option's rule for an exercise: unset, or on/off with a lock.
  function ruleOf(exercise: ExerciseDraft, key: SettingKey) {
    return exercise.settings[key] as { value: boolean; locked: boolean } | undefined;
  }

  function setRule(exercise: ExerciseDraft, key: SettingKey, value: boolean | null) {
    if (value === null) {
      delete exercise.settings[key];
    } else {
      (exercise.settings as Record<SettingKey, unknown>)[key] = {
        value,
        locked: ruleOf(exercise, key)?.locked ?? false,
      };
    }
  }

  function setLocked(exercise: ExerciseDraft, key: SettingKey, locked: boolean) {
    const rule = ruleOf(exercise, key);
    if (rule) rule.locked = locked;
  }

  // Only the options the exercise's kind shows are kept, so switching kinds
  // doesn't save rules for options the player never saw.
  function settingsOf(exercise: ExerciseDraft): ExerciseSettings | undefined {
    const keys = exerciseGroups(exercise.kind).flatMap((group) =>
      group.toggles.map((toggle) => toggle.key)
    );
    const kept = Object.fromEntries(
      Object.entries(exercise.settings).filter(([key]) => keys.includes(key as SettingKey))
    ) as ExerciseSettings;
    return Object.keys(kept).length > 0 ? kept : undefined;
  }

  function ruleCount(exercise: ExerciseDraft): number {
    return Object.keys(settingsOf(exercise) ?? {}).length;
  }

  function filterOfPick(pick: PickDraft): RangeFilter {
    return {
      types: pick.types,
      positions: pick.positions.length ? pick.positions : undefined,
      opponents: pick.opponents.length ? pick.opponents : undefined,
    };
  }

  function filterOf(exercise: ExerciseDraft): ChartPick {
    const filters = exercise.picks.map(filterOfPick);
    return filters.length === 1 ? filters[0] : filters;
  }

  function copyPicks(picks: PickDraft[]): PickDraft[] {
    return picks.map((pick) => ({
      positions: [...pick.positions],
      types: [...pick.types],
      opponents: [...pick.opponents],
    }));
  }

  function templateOf(exercise: ExerciseDraft): ExerciseTemplate {
    const filter = filterOf(exercise);
    const settings = settingsOf(exercise);
    return exercise.kind === "range"
      ? { kind: "range", filter, timesInARow: exercise.timesInARow, settings }
      : {
          kind: "hands",
          filter,
          count: clampCount(exercise.count),
          mistakes: exercise.mistakes,
          repeatMistakes: exercise.repeatMistakes,
          settings,
        };
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
    for (const exercise of exercises) exercise.picks = [blankPick()];
  }

  function toggle(list: string[], item: string): string[] {
    return list.includes(item) ? list.filter((other) => other !== item) : [...list, item];
  }

  function addExercise(kind: "range" | "hands") {
    // A new exercise starts with the picks of the last one, since "rebuild
    // these charts, then answer hands from them" is the usual shape.
    const last = exercises.at(-1);
    exercises.push(
      last
        ? {
            ...blankExercise(kind),
            picks: copyPicks(last.picks),
            settings: structuredClone($state.snapshot(last.settings)),
          }
        : blankExercise(kind)
    );
  }

  function addPick(exercise: ExerciseDraft) {
    exercise.picks.push(blankPick());
  }

  function removePick(exercise: ExerciseDraft, index: number) {
    exercise.picks.splice(index, 1);
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

          <div class="flex flex-col gap-3">
            <span class="label">Charts</span>
            {#each exercise.picks as pick, pickIndex (pick)}
              {@const pickDetail = detail.picks[pickIndex]}
              <div
                class="flex flex-col gap-3 rounded-xl border border-ink-700 bg-ink-850/60 p-3"
                data-pick
              >
                {#if exercise.picks.length > 1}
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-ink-300">Charts {pickIndex + 1}</span>
                    <span class="text-sm muted" data-pick-count>
                      {pickDetail.chartCount}
                      {pickDetail.chartCount === 1 ? "chart" : "charts"}
                    </span>
                    <button
                      class="btn btn-ghost ml-auto py-1"
                      onclick={() => removePick(exercise, pickIndex)}>Remove</button
                    >
                  </div>
                {/if}

                <div class="flex flex-col gap-1.5">
                  <span class="label">
                    Situation
                    {#if pick.types.length === 0}<span class="font-normal tracking-normal normal-case text-ink-600">(all)</span>{/if}
                  </span>
                  <div class="flex flex-wrap gap-1.5">
                    {#each types as type}
                      <button
                        class="chip {pick.types.includes(type) ? 'chip-active' : ''}"
                        onclick={() => (pick.types = toggle(pick.types, type))}>{type}</button
                      >
                    {/each}
                  </div>
                </div>

                <div class="flex flex-col gap-1.5">
                  <span class="label">
                    Your position
                    {#if pick.positions.length === 0}<span class="font-normal tracking-normal normal-case text-ink-600">(all)</span>{/if}
                  </span>
                  <div class="flex flex-wrap gap-1.5">
                    {#each pickDetail.positions as position}
                      <button
                        class="chip {pick.positions.includes(position) ? 'chip-active' : ''}"
                        onclick={() => (pick.positions = toggle(pick.positions, position))}>{position}</button
                      >
                    {/each}
                  </div>
                </div>

                {#if pickDetail.opponents.length > 0}
                  <div class="flex flex-col gap-1.5">
                    <span class="label">
                      Opponent
                      {#if pick.opponents.length === 0}<span class="font-normal tracking-normal normal-case text-ink-600">(all)</span>{/if}
                    </span>
                    <div class="flex flex-wrap gap-1.5">
                      {#each pickDetail.opponents as opponent}
                        <button
                          class="chip {pick.opponents.includes(opponent) ? 'chip-active' : ''}"
                          onclick={() => (pick.opponents = toggle(pick.opponents, opponent))}>{opponent}</button
                        >
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
            <!-- A second set of charts is for a mix that one set can't say,
                 like every open plus the big blind's defense. -->
            <button class="btn btn-secondary self-start" onclick={() => addPick(exercise)}>
              + Add more charts
            </button>
          </div>

          <!-- What the trainer shows during this exercise. An option left as
               the player's choice follows their Options menu; one set here
               starts on or off, and locked, can't be changed in the menu. -->
          <details class="flex flex-col gap-3" data-exercise-options>
            <summary class="flex cursor-pointer items-center gap-2 select-none">
              <span class="label">Options</span>
              <span class="text-sm muted">
                {#if ruleCount(exercise) === 0}
                  all the player's choice
                {:else}
                  {ruleCount(exercise)} set
                {/if}
              </span>
            </summary>
            <div class="mt-3 flex flex-col gap-4">
              {#if exercise.kind === "hands"}
                <div class="flex flex-col gap-2">
                  <span class="label">Rules</span>
                  <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span class="text-sm">After a mistake</span>
                    <div class="flex gap-1.5" role="radiogroup" aria-label="After a mistake">
                      {#each mistakeModes as mode}
                        <button
                          class="chip {exercise.mistakes === mode.value ? 'chip-active' : ''}"
                          role="radio"
                          aria-checked={exercise.mistakes === mode.value}
                          onclick={() => (exercise.mistakes = mode.value)}>{mode.label}</button
                        >
                      {/each}
                    </div>
                  </div>
                  <label class="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      class="accent-accent-500"
                      bind:checked={exercise.repeatMistakes}
                    />
                    Wrong hands come back at the end
                  </label>
                </div>
              {/if}
              {#each exerciseGroups(exercise.kind) as group (group.label)}
                <div class="flex flex-col gap-2">
                  <span class="label">{group.label}</span>
                  {#each group.toggles as toggle (toggle.key)}
                    {@const rule = ruleOf(exercise, toggle.key)}
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5" data-option={toggle.key}>
                      <span class="w-56 text-sm">{toggle.label}</span>
                      <div class="flex gap-1.5" role="radiogroup" aria-label={toggle.label}>
                        <button
                          class="chip {rule === undefined ? 'chip-active' : ''}"
                          role="radio"
                          aria-checked={rule === undefined}
                          onclick={() => setRule(exercise, toggle.key, null)}>Player's choice</button
                        >
                        <button
                          class="chip {rule?.value === true ? 'chip-active' : ''}"
                          role="radio"
                          aria-checked={rule?.value === true}
                          onclick={() => setRule(exercise, toggle.key, true)}>On</button
                        >
                        <button
                          class="chip {rule?.value === false ? 'chip-active' : ''}"
                          role="radio"
                          aria-checked={rule?.value === false}
                          onclick={() => setRule(exercise, toggle.key, false)}>Off</button
                        >
                      </div>
                      <label
                        class="flex items-center gap-2 text-sm whitespace-nowrap {rule
                          ? 'cursor-pointer'
                          : 'cursor-default opacity-40'}"
                      >
                        <input
                          type="checkbox"
                          class="accent-accent-500"
                          checked={rule?.locked ?? false}
                          disabled={rule === undefined}
                          onchange={(e) => setLocked(exercise, toggle.key, e.currentTarget.checked)}
                        />
                        Locked
                      </label>
                    </div>
                  {/each}
                </div>
              {/each}
            </div>
          </details>
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
