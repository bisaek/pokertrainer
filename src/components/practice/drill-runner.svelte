<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import RangeLayout from "@components/range/range-layout.svelte";
  import HandQuiz from "./hand-quiz.svelte";
  import { PokerRange } from "@utils/range.svelte";
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
    const ranges = await Promise.all(
      current.exercises[index].urls.map(async (url) =>
        PokerRange.fromJSON(await (await fetch(url)).json())
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
    const streak = isCorrect ? item.streak + 1 : 0;
    queue =
      streak >= exercise.timesInARow
        ? rest
        : [...rest, { range: item.range, streak }];
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

<div class="p-4 flex flex-col gap-2">
  <div class="flex items-center gap-4">
    <button
      class="bg-gray-300 hover:bg-gray-400 px-3 py-1 rounded"
      onclick={onback}>{backLabel}</button
    >
    <h1 class="text-3xl">{drill.name}</h1>
  </div>

  {#if finished}
    <p class="text-2xl text-center py-8">{completeText}</p>
    <div class="flex justify-center gap-2">
      {#each doneActions as action}
        <button
          class="{action.primary
            ? 'bg-green-500 hover:bg-green-600 text-white'
            : 'bg-gray-300 hover:bg-gray-400'} px-3 py-1 rounded"
          onclick={action.onclick}>{action.label}</button
        >
      {/each}
      <button
        class="bg-gray-300 hover:bg-gray-400 px-3 py-1 rounded"
        onclick={() => restart()}>{againLabel}</button
      >
      <button
        class="bg-gray-300 hover:bg-gray-400 px-3 py-1 rounded"
        onclick={onback}>{backLabel}</button
      >
    </div>
  {:else if loading || !exercise}
    <p class="text-center py-8">Loading…</p>
  {:else}
    <p class="text-gray-600">
      Exercise {exerciseIndex + 1} of {drill.exercises.length}: {describeExercise(
        exercise
      )}
    </p>

    {#if exercise.kind === "range"}
      {#if queue[0]}
        <h2 class="text-2xl text-center">{queue[0].range.name}</h2>
        <p class="text-center text-sm text-gray-600">
          {queue.length}
          {queue.length === 1 ? "chart" : "charts"} left
          {#if exercise.timesInARow > 1}
            · correct in a row: {queue[0].streak}/{exercise.timesInARow}
          {/if}
        </p>
      {/if}
      <RangeLayout {pokerRange} {compareTo} {isCorrect}>
        <div>
          {#if compareTo}
            <button
              class="bg-gray-300 hover:bg-gray-400 px-3 py-1 m-1 rounded"
              onclick={next}>Next</button
            >
          {:else}
            <button
              class="bg-gray-300 hover:bg-gray-400 px-3 py-1 m-1 rounded"
              onclick={check}>Check</button
            >
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
  {/if}
</div>
