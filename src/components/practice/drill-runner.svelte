<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import RangeLayout from "@components/range/range-layout.svelte";
  import HandQuiz from "./hand-quiz.svelte";
  import { Action, PokerRange } from "@utils/range.svelte";
  import { fetchChart } from "@utils/manifest";
  import { spotFromUrl } from "@utils/spot";
  import { blankRangeFor, isRangeCorrect } from "@utils/practice";
  import { describeExercise, type Drill } from "@utils/drills";

  type DoneAction = { label: string; onclick: () => void; primary?: boolean };

  let {
    drill,
    backLabel,
    onback,
    onfinish = undefined,
    completeText = "Drill complete!",
    againLabel = "Do it again",
    doneActions = [],
  }: {
    drill: Drill;
    backLabel: string;
    onback: () => void;
    // Called once when the last exercise is finished.
    onfinish?: () => void;
    completeText?: string;
    againLabel?: string;
    // Extra buttons shown first when the drill is complete, e.g. "Next lesson".
    doneActions?: DoneAction[];
  } = $props();

  let exerciseIndex = $state(0);
  let exerciseRanges: PokerRange[] = $state.raw([]);
  let loading = $state(true);
  let loadError: string | null = $state(null);
  let finished = $state(false);
  let loadToken = 0;

  // Rebuild exercise: a chart leaves the queue once it has been rebuilt
  // correctly enough times in a row.
  let queue: { range: PokerRange; streak: number }[] = $state.raw([]);
  let pokerRange = $state(new PokerRange());
  let compareTo: PokerRange | undefined = $state();
  let isCorrect: boolean | undefined = $state();

  const exercise = $derived(drill.exercises[exerciseIndex]);

  $effect(() => {
    const current = drill;
    untrack(() => restart(current));
  });

  // Ignore a load that finishes after leaving.
  onDestroy(() => loadToken++);

  function restart(current: Drill = drill) {
    finished = false;
    loadExercise(current, 0);
  }

  async function loadExercise(current: Drill, index: number) {
    const token = ++loadToken;
    exerciseIndex = index;
    loading = true;
    loadError = null;
    try {
      const ranges = await Promise.all(
        current.exercises[index].urls.map(async (url) =>
          PokerRange.fromJSON(
            (await fetchChart(url)) as { range: Action[]; name: string },
            spotFromUrl(url)
          )
        )
      );
      // Ignore a load that finished after leaving or restarting the drill.
      if (token !== loadToken) return;
      exerciseRanges = ranges;
      queue = ranges.map((range) => ({ range, streak: 0 }));
      compareTo = undefined;
      isCorrect = undefined;
      pokerRange = blankRangeFor(ranges[0]);
      loading = false;
    } catch (error) {
      if (token !== loadToken) return;
      // Without this the drill would sit on "Loading…" forever.
      loadError = error instanceof Error ? error.message : String(error);
      loading = false;
    }
  }

  function finishExercise() {
    if (exerciseIndex + 1 < drill.exercises.length) {
      loadExercise(drill, exerciseIndex + 1);
    } else {
      finished = true;
      onfinish?.();
    }
  }

  function check() {
    if (!queue[0]) return;
    compareTo = queue[0].range;
    isCorrect = isRangeCorrect(pokerRange, compareTo);
  }

  function next() {
    const [item, ...rest] = queue;
    if (!item || exercise?.kind !== "range") return;
    if (isCorrect) {
      const streak = item.streak + 1;
      queue =
        streak >= exercise.timesInARow
          ? rest
          : [...rest, { range: item.range, streak }];
    } else {
      // Wrong: rebuild it again right away, and once more at the end.
      const again = { range: item.range, streak: 0 };
      queue =
        rest.at(-1)?.range === item.range
          ? [again, ...rest]
          : [again, ...rest, { range: item.range, streak: 0 }];
    }
    compareTo = undefined;
    isCorrect = undefined;
    if (queue.length === 0) {
      finishExercise();
    } else {
      pokerRange = blankRangeFor(queue[0].range);
    }
  }

  function keyPressed(event: KeyboardEvent) {
    if (finished || loading || exercise?.kind !== "range") return;
    if (["Enter", " "].includes(event.key)) {
      event.preventDefault();
      if (compareTo) {
        next();
      } else {
        check();
      }
    }
  }
</script>

<svelte:window onkeypress={keyPressed} />

<div class="page page-fill">
  <header class="flex flex-col gap-2">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
      <button class="btn btn-ghost -ml-3" onclick={onback}>
        <span aria-hidden="true">←</span>
        {backLabel}
      </button>
      <h1 class="page-title">{drill.name}</h1>
      {#if !finished}
        <p class="text-sm muted">
          Exercise {exerciseIndex + 1} of {drill.exercises.length}{exercise
            ? `: ${describeExercise(exercise)}`
            : ""}
        </p>
      {/if}
    </div>
    {#if !finished}
      <div class="flex gap-1.5" aria-hidden="true">
        {#each drill.exercises as _, index}
          <div
            class="h-1.5 flex-1 rounded-full {index < exerciseIndex
              ? 'bg-accent-500'
              : index === exerciseIndex
                ? 'bg-accent-500/50'
                : 'bg-ink-800'}"
          ></div>
        {/each}
      </div>
    {/if}
  </header>

  {#if finished}
    <section class="card flex flex-col items-center gap-5 py-12 text-center">
      <div
        class="grid h-14 w-14 place-items-center rounded-full bg-accent-500/15 text-3xl text-accent-300"
        aria-hidden="true"
      >
        ✓
      </div>
      <p class="text-2xl font-semibold">{completeText}</p>
      <div class="flex flex-wrap justify-center gap-2">
        {#each doneActions as action}
          <button
            class="btn {action.primary ? 'btn-primary' : 'btn-secondary'}"
            onclick={action.onclick}>{action.label}</button
          >
        {/each}
        <button class="btn btn-secondary" onclick={() => restart()}
          >{againLabel}</button
        >
        <button class="btn btn-ghost" onclick={onback}>{backLabel}</button>
      </div>
    </section>
  {:else if loadError}
    <section
      class="card flex flex-col items-center gap-3 border-red-500/40 py-12 text-center"
      data-load-error
    >
      <p class="text-lg font-semibold">This drill's charts didn't load</p>
      <p class="max-w-md text-sm muted">{loadError}</p>
      <div class="flex flex-wrap justify-center gap-2">
        <button class="btn btn-primary" onclick={() => loadExercise(drill, exerciseIndex)}
          >Try again</button
        >
        <button class="btn btn-ghost" onclick={onback}>{backLabel}</button>
      </div>
    </section>
  {:else if loading || !exercise}
    <p class="py-12 text-center muted">Loading…</p>
  {:else if exercise.kind === "range"}
    <RangeLayout {pokerRange} {compareTo} {isCorrect} spot={queue[0]?.range.spot}>
      <div class="flex flex-col gap-3 border-t border-ink-700 pt-4">
        {#if queue[0]}
          <div class="flex flex-col gap-1">
            <span class="label">Rebuild this chart</span>
            <h2 class="text-lg leading-snug font-semibold" data-chart-name>
              {queue[0].range.name}
            </h2>
            <p class="text-sm muted">
              {queue.length}
              {queue.length === 1 ? "chart" : "charts"} left
              {#if exercise.timesInARow > 1}
                · correct in a row: {queue[0].streak}/{exercise.timesInARow}
              {/if}
            </p>
          </div>
        {/if}
        {#if compareTo}
          <p class="text-sm font-medium {isCorrect ? 'text-emerald-300' : 'text-red-300'}">
            {isCorrect ? "Correct!" : "Not quite. The outlines show the chart."}
          </p>
          <button class="btn btn-primary w-full" onclick={next}>
            Next <span class="kbd" aria-hidden="true">Enter</span>
          </button>
        {:else}
          <button class="btn btn-primary w-full" onclick={check}>
            Check <span class="kbd" aria-hidden="true">Enter</span>
          </button>
        {/if}
      </div>
    </RangeLayout>
  {:else}
    {#key exerciseIndex}
      <HandQuiz
        ranges={exerciseRanges}
        count={exercise.count}
        onfinish={finishExercise}
      />
    {/key}
  {/if}
</div>
