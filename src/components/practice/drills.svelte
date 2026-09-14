<script lang="ts">
  import RangeLayout from "@components/range/range-layout.svelte";
  import HandQuiz from "./hand-quiz.svelte";
  import { PokerRange } from "@utils/range.svelte";
  import { fetchManifest, type RangeInfo } from "@utils/manifest";
  import { blankRangeFor, isRangeCorrect } from "@utils/practice";
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

  let drill = $state<Drill | null>(null);
  let exerciseIndex = $state(0);
  let exerciseRanges: PokerRange[] = $state.raw([]);
  let loading = $state(false);
  let finished = $state(false);
  let loadToken = 0;

  // Rebuild exercise: a chart leaves the queue once it has been rebuilt
  // correctly enough times in a row.
  let queue: { range: PokerRange; streak: number }[] = $state.raw([]);
  let pokerRange = $state(new PokerRange());
  let compareTo: PokerRange | undefined = $state();
  let isCorrect: boolean | undefined = $state();

  const exercise = $derived(drill?.exercises[exerciseIndex]);

  function startDrill(next: Drill) {
    drill = next;
    finished = false;
    loadExercise(0);
  }

  function leaveDrill() {
    loadToken++;
    drill = null;
  }

  async function loadExercise(index: number) {
    if (!drill) return;
    const token = ++loadToken;
    exerciseIndex = index;
    loading = true;
    const ranges = await Promise.all(
      drill.exercises[index].urls.map(async (url) =>
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
    if (drill && exerciseIndex + 1 < drill.exercises.length) {
      loadExercise(exerciseIndex + 1);
    } else {
      finished = true;
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
    if (!drill || finished || loading || exercise?.kind !== "range") return;
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

{#if drill}
  <div class="p-4 flex flex-col gap-2">
    <div class="flex items-center gap-4">
      <button
        class="bg-gray-300 hover:bg-gray-400 px-3 py-1 rounded"
        onclick={leaveDrill}>Back to drills</button
      >
      <h1 class="text-3xl">{drill.name}</h1>
    </div>

    {#if finished}
      <p class="text-2xl text-center py-8">Drill complete!</p>
      <div class="flex justify-center gap-2">
        <button
          class="bg-gray-300 hover:bg-gray-400 px-3 py-1 rounded"
          onclick={() => drill && startDrill(drill)}>Do it again</button
        >
        <button
          class="bg-gray-300 hover:bg-gray-400 px-3 py-1 rounded"
          onclick={leaveDrill}>Back to drills</button
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
              onclick={() => startDrill(item)}
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
