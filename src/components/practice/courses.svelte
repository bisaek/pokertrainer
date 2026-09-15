<script lang="ts">
  import { onMount } from "svelte";
  import DrillRunner from "./drill-runner.svelte";
  import { fetchManifest, type RangeInfo } from "@utils/manifest";
  import { describeExercise } from "@utils/drills";
  import { ACTION_ORDER, actionShares, type ActionShare } from "@utils/chart-stats";
  import {
    courses,
    lessonStack,
    lessonStatsUrls,
    resolveLesson,
    type Course,
  } from "@utils/courses";

  const PROGRESS_KEY = "pokertrainer.courses.v1";
  const gameLabels: Record<string, string> = { mtt: "Tournament", cash: "Cash" };

  // Course id -> ids of the lessons completed.
  type Progress = Record<string, string[]>;
  type StatsRow = { name: string; reach: number; shares: ActionShare[] };

  let manifest: RangeInfo[] = $state.raw([]);
  let manifestReady: Promise<RangeInfo[]> = Promise.resolve([]);
  let progress: Progress = $state.raw({});
  let courseId: string | null = $state(null);
  let lessonIndex: number | null = $state(null);
  let practicing = $state(false);
  let stats: StatsRow[] = $state.raw([]);
  let statsLoading = $state(false);
  let statsToken = 0;

  const course = $derived(courses.find((c) => c.id === courseId) ?? null);
  const lesson = $derived(
    course && lessonIndex !== null ? (course.lessons[lessonIndex] ?? null) : null
  );
  const drill = $derived(
    course && lesson && manifest.length > 0
      ? resolveLesson(course, lesson, manifest)
      : null
  );
  const statsActions = $derived(
    ACTION_ORDER.filter((action) =>
      stats.some((row) => row.shares.some((share) => share.action === action))
    )
  );
  const showReach = $derived(stats.some((row) => row.reach < 99.95));
  // Buttons shown when a lesson's practice is finished.
  const lessonDoneActions = $derived.by(() => {
    if (!course || lessonIndex === null) return [];
    const current = course;
    const index = lessonIndex;
    const actions: { label: string; onclick: () => void; primary?: boolean }[] = [];
    if (index + 1 < current.lessons.length) {
      actions.push({
        label: "Next lesson",
        primary: true,
        onclick: () => openLesson(current, index + 1),
      });
    }
    actions.push({ label: "Back to course", onclick: () => openCourse(current) });
    return actions;
  });

  onMount(() => {
    try {
      progress = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "{}");
    } catch {
      progress = {};
    }
    manifestReady = fetchManifest().then((json) => (manifest = json));
  });

  function saveProgress() {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch {
      // Storage is full or blocked; progress lasts until the page is closed.
    }
  }

  function completedIn(c: Course) {
    const ids = new Set(progress[c.id] ?? []);
    return c.lessons.filter((l) => ids.has(l.id)).length;
  }

  function isCompleted(c: Course, lessonId: string) {
    return (progress[c.id] ?? []).includes(lessonId);
  }

  function markCompleted(c: Course, lessonId: string) {
    if (isCompleted(c, lessonId)) return;
    progress = { ...progress, [c.id]: [...(progress[c.id] ?? []), lessonId] };
    saveProgress();
  }

  function resetProgress(c: Course) {
    if (!confirm(`Reset your progress in "${c.name}"?`)) return;
    const { [c.id]: _, ...rest } = progress;
    progress = rest;
    saveProgress();
  }

  function nextLessonIndex(c: Course) {
    const index = c.lessons.findIndex((l) => !isCompleted(c, l.id));
    return index === -1 ? 0 : index;
  }

  function openCourse(c: Course | null) {
    courseId = c?.id ?? null;
    lessonIndex = null;
    practicing = false;
    window.scrollTo(0, 0);
  }

  function openLesson(c: Course, index: number) {
    courseId = c.id;
    lessonIndex = index;
    practicing = false;
    window.scrollTo(0, 0);
    loadStats(c, index);
  }

  async function loadStats(c: Course, index: number) {
    const token = ++statsToken;
    stats = [];
    const target = c.lessons[index];
    if (!target.stats) {
      statsLoading = false;
      return;
    }
    statsLoading = true;
    const loaded = await manifestReady;
    const charts = await Promise.all(
      lessonStatsUrls(c, target, loaded).map(async (url) => (await fetch(url)).json())
    );
    // Ignore stats for a lesson that is no longer open.
    if (token !== statsToken) return;
    stats = charts.map((chart) => ({ name: chart.name, ...actionShares(chart.range) }));
    statsLoading = false;
  }

  function percentFor(row: StatsRow, action: string) {
    const share = row.shares.find((s) => s.action === action);
    return share ? `${share.percent.toFixed(1)}%` : "–";
  }
</script>

{#snippet progressBar(done: number, total: number)}
  <div class="flex items-center gap-2">
    <div class="h-2 flex-1 bg-gray-200 rounded">
      <div
        class="h-2 bg-green-500 rounded"
        style="width: {total ? (done / total) * 100 : 0}%"
      ></div>
    </div>
    <span class="text-sm text-gray-600 whitespace-nowrap">{done}/{total} lessons</span>
  </div>
{/snippet}

{#if course && lesson && practicing && drill}
  <DrillRunner
    {drill}
    backLabel="Back to lesson"
    onback={() => (practicing = false)}
    onfinish={() => markCompleted(course, lesson.id)}
    completeText="Lesson complete!"
    againLabel="Practice again"
    doneActions={lessonDoneActions}
  />
{:else if course && lesson && lessonIndex !== null}
  <div class="p-4 flex flex-col gap-4 max-w-4xl mx-auto">
    <div class="flex items-center gap-4">
      <button
        class="bg-gray-300 hover:bg-gray-400 px-3 py-1 rounded"
        onclick={() => openCourse(course)}>Back to course</button
      >
      <span class="text-gray-600">
        {course.name} · Lesson {lessonIndex + 1} of {course.lessons.length} ·
        {gameLabels[course.game] ?? course.game}
        {lessonStack(course, lesson)}bb
      </span>
    </div>

    <h1 class="text-3xl">
      {lesson.title}
      {#if isCompleted(course, lesson.id)}
        <span class="text-green-600 text-xl align-middle">✓ completed</span>
      {/if}
    </h1>

    {#each lesson.body as paragraph}
      <p class="text-lg">{paragraph}</p>
    {/each}

    {#if lesson.stats}
      <div class="overflow-x-auto">
        {#if statsLoading}
          <p class="text-gray-600">Loading charts…</p>
        {:else if stats.length > 0}
          <table class="text-sm">
            <thead class="text-left border-b">
              <tr>
                <th class="p-2">Chart</th>
                {#if showReach}
                  <th class="p-2" title="Share of all starting hands that reach this spot"
                    >Hands in chart</th
                  >
                {/if}
                {#each statsActions as action}
                  <th class="p-2 text-right">{action}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each stats as row}
                <tr class="border-b">
                  <td class="p-2 whitespace-nowrap">{row.name}</td>
                  {#if showReach}
                    <td class="p-2 text-right">{row.reach.toFixed(1)}%</td>
                  {/if}
                  {#each statsActions as action}
                    <td class="p-2 text-right">{percentFor(row, action)}</td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
          <p class="text-xs text-gray-500 mt-1">
            Share of the hands in each chart, weighted by hand combinations, using
            each hand's action in the trainers.
          </p>
        {/if}
      </div>
    {/if}

    <div class="border rounded p-3 flex flex-col gap-2">
      <h2 class="text-xl">Practice</h2>
      {#if drill}
        <p class="text-gray-600">
          {drill.chartCount}
          {drill.chartCount === 1 ? "chart" : "charts"}: {drill.exercises
            .map(describeExercise)
            .join(", then ")}. Finishing marks the lesson as completed.
        </p>
        <div>
          <button
            class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            onclick={() => (practicing = true)}>Start practice</button
          >
        </div>
      {:else if manifest.length > 0}
        <p class="text-gray-600">No charts exist for this lesson.</p>
      {:else}
        <p class="text-gray-600">Loading…</p>
      {/if}
    </div>

    <div class="flex justify-between">
      {#if lessonIndex > 0}
        <button
          class="underline cursor-pointer"
          onclick={() => lessonIndex !== null && openLesson(course, lessonIndex - 1)}
          >← {course.lessons[lessonIndex - 1].title}</button
        >
      {:else}
        <span></span>
      {/if}
      {#if lessonIndex + 1 < course.lessons.length}
        <button
          class="underline cursor-pointer"
          onclick={() => lessonIndex !== null && openLesson(course, lessonIndex + 1)}
          >{course.lessons[lessonIndex + 1].title} →</button
        >
      {/if}
    </div>
  </div>
{:else if course}
  <div class="p-4 flex flex-col gap-4 max-w-4xl mx-auto">
    <div>
      <button
        class="bg-gray-300 hover:bg-gray-400 px-3 py-1 rounded"
        onclick={() => openCourse(null)}>All courses</button
      >
    </div>
    <h1 class="text-3xl">{course.name}</h1>
    <p class="text-lg">{course.description}</p>
    {@render progressBar(completedIn(course), course.lessons.length)}
    <div class="flex gap-2">
      <button
        class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
        onclick={() => openLesson(course, nextLessonIndex(course))}
      >
        {completedIn(course) === 0
          ? "Start course"
          : completedIn(course) === course.lessons.length
            ? "Review from the start"
            : "Continue"}
      </button>
      {#if completedIn(course) > 0}
        <button
          class="ml-auto text-sm underline cursor-pointer"
          onclick={() => resetProgress(course)}>Reset progress</button
        >
      {/if}
    </div>

    <ol class="flex flex-col gap-2">
      {#each course.lessons as item, index (item.id)}
        <li>
          <button
            class="w-full text-left p-3 border rounded cursor-pointer hover:bg-gray-100 flex items-center gap-3"
            onclick={() => openLesson(course, index)}
          >
            <span
              class="w-7 h-7 rounded-full flex items-center justify-center text-sm {isCompleted(
                course,
                item.id
              )
                ? 'bg-green-500 text-white'
                : 'bg-gray-200'}"
            >
              {isCompleted(course, item.id) ? "✓" : index + 1}
            </span>
            <span class="flex-1">{item.title}</span>
            <span class="text-sm text-gray-500"
              >{lessonStack(course, item)}bb</span
            >
          </button>
        </li>
      {/each}
    </ol>
  </div>
{:else}
  <div class="p-4 flex flex-col gap-4 max-w-4xl mx-auto">
    <h1 class="text-3xl">Courses</h1>
    <p class="text-gray-600">
      Step-by-step lessons: a short explanation, the numbers from the charts,
      then practice. Your progress is saved in this browser.
    </p>
    <div class="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {#each courses as item (item.id)}
        <button
          class="text-left p-4 border rounded cursor-pointer hover:bg-gray-100 flex flex-col gap-2"
          onclick={() => openCourse(item)}
        >
          <span class="text-xs uppercase tracking-wide text-gray-500">
            {gameLabels[item.game] ?? item.game}
          </span>
          <span class="text-xl font-semibold">{item.name}</span>
          <span class="text-sm text-gray-600 flex-1">{item.description}</span>
          {@render progressBar(completedIn(item), item.lessons.length)}
        </button>
      {/each}
    </div>
  </div>
{/if}
