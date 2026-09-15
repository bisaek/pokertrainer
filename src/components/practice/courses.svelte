<script lang="ts">
  import { onMount } from "svelte";
  import DrillRunner from "./drill-runner.svelte";
  import { getButtonClass, type Action } from "@utils/range.svelte";
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
  import {
    loadCustomCourses,
    parseCourse,
    removeCustomCourse,
    upsertCustomCourse,
  } from "@utils/course-file";

  const PROGRESS_KEY = "pokertrainer.courses.v1";
  const gameLabels: Record<string, string> = { mtt: "Tournament", cash: "Cash" };

  // Course id -> ids of the lessons completed.
  type Progress = Record<string, string[]>;
  type StatsRow = { name: string; reach: number; shares: ActionShare[] };

  let manifest: RangeInfo[] = $state.raw([]);
  let manifestReady: Promise<RangeInfo[]> = Promise.resolve([]);
  let progress: Progress = $state.raw({});
  let customCourses: Course[] = $state.raw([]);
  let loadMessage: { kind: "ok" | "error"; text: string } | null = $state(null);
  let courseId: string | null = $state(null);
  let lessonIndex: number | null = $state(null);
  let practicing = $state(false);
  let stats: StatsRow[] = $state.raw([]);
  let statsLoading = $state(false);
  let statsToken = 0;

  const allCourses = $derived([...courses, ...customCourses]);
  const course = $derived(allCourses.find((c) => c.id === courseId) ?? null);
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
    customCourses = loadCustomCourses();
    manifestReady = fetchManifest().then((json) => (manifest = json));
  });

  function saveProgress() {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch {
      // Storage is full or blocked; progress lasts until the page is closed.
    }
  }

  function isCustom(c: Course) {
    return customCourses.some((item) => item.id === c.id);
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

  async function loadCourseFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const result = parseCourse(JSON.parse(await file.text()));
      if ("errors" in result) {
        loadMessage = {
          kind: "error",
          text: `Couldn't load ${file.name}: ${result.errors.slice(0, 3).join(" ")}`,
        };
        return;
      }
      const loaded = result.course;
      const existed = customCourses.some((item) => item.id === loaded.id);
      customCourses = upsertCustomCourse(loaded);
      const withoutCharts = loaded.lessons.filter(
        (item) => !resolveLesson(loaded, item, manifest)
      ).length;
      loadMessage = {
        kind: "ok",
        text:
          `${existed ? "Updated" : "Added"} “${loaded.name}”.` +
          (manifest.length > 0 && withoutCharts > 0
            ? ` ${withoutCharts} of its lessons have no matching charts.`
            : ""),
      };
    } catch {
      loadMessage = { kind: "error", text: `Couldn't load ${file.name}: it isn't valid JSON.` };
    } finally {
      input.value = "";
    }
  }

  function removeCourse(c: Course) {
    if (!confirm(`Remove "${c.name}" from your courses?`)) return;
    customCourses = removeCustomCourse(c.id);
    loadMessage = { kind: "ok", text: `Removed “${c.name}”.` };
    if (courseId === c.id) openCourse(null);
  }
</script>

{#snippet progressBar(done: number, total: number)}
  <div class="flex items-center gap-3">
    <div class="progress flex-1">
      <div
        class="progress-bar"
        style="width: {total ? (done / total) * 100 : 0}%"
      ></div>
    </div>
    <span class="text-sm whitespace-nowrap tabular-nums muted">{done}/{total} lessons</span>
  </div>
{/snippet}

{#snippet backButton(label: string, onclick: () => void)}
  <div>
    <button class="btn btn-ghost -ml-3" {onclick}>
      <span aria-hidden="true">←</span>
      {label}
    </button>
  </div>
{/snippet}

{#snippet courseCard(item: Course)}
  <div class="card card-interactive flex flex-col p-0" data-course-card>
    <button class="flex flex-1 flex-col gap-3 p-4 text-left sm:p-5" onclick={() => openCourse(item)}>
      <span class="label">
        {isCustom(item) ? "Your course · " : ""}{gameLabels[item.game] ?? item.game} ·
        {item.lessons.length}
        {item.lessons.length === 1 ? "lesson" : "lessons"}
      </span>
      <span class="text-xl font-semibold text-ink-100" data-course-name>{item.name}</span>
      <span class="flex-1 text-sm text-ink-300">{item.description}</span>
      {@render progressBar(completedIn(item), item.lessons.length)}
    </button>
    {#if isCustom(item)}
      <div class="flex gap-1 border-t border-ink-700 px-3 py-2">
        <a class="btn btn-ghost text-sm" href="/course-builder?edit={encodeURIComponent(item.id)}"
          >Edit</a
        >
        <button class="btn btn-ghost text-sm" onclick={() => removeCourse(item)}>Remove</button>
      </div>
    {/if}
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
  <article class="page page-narrow">
    <header class="flex flex-col gap-3">
      {@render backButton("Back to course", () => openCourse(course))}
      <span class="eyebrow">
        {course.name} · Lesson {lessonIndex + 1} of {course.lessons.length} ·
        {gameLabels[course.game] ?? course.game}
        {lessonStack(course, lesson)}bb
      </span>
      <h1 class="page-title">{lesson.title}</h1>
      {#if isCompleted(course, lesson.id)}
        <div><span class="badge badge-good">✓ Completed</span></div>
      {/if}
    </header>

    <div class="flex flex-col gap-4 text-lg leading-relaxed text-ink-300" data-lesson-body>
      {#each lesson.body as paragraph}
        <p>{paragraph}</p>
      {/each}
    </div>

    {#if lesson.stats}
      {#if statsLoading}
        <p class="muted">Loading charts…</p>
      {:else if stats.length > 0}
        <section class="card overflow-hidden p-0">
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Chart</th>
                  {#if showReach}
                    <th
                      class="text-right"
                      title="Share of all starting hands that reach this spot"
                      >Hands in chart</th
                    >
                  {/if}
                  {#each statsActions as action}
                    <th class="text-right"
                      ><span
                        class="action-dot {getButtonClass(action as Action)}"
                        aria-hidden="true"
                      ></span>{action}</th
                    >
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each stats as row}
                  <tr>
                    <td class="whitespace-nowrap">{row.name}</td>
                    {#if showReach}
                      <td class="text-right tabular-nums">{row.reach.toFixed(1)}%</td>
                    {/if}
                    {#each statsActions as action}
                      <td class="text-right tabular-nums">{percentFor(row, action)}</td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          <p class="px-4 py-3 text-xs muted">
            Share of the hands in each chart, weighted by hand combinations, using
            each hand's action in the trainers.
          </p>
        </section>
      {/if}
    {/if}

    <section class="card flex flex-col gap-3 border-accent-600/50 bg-accent-500/5">
      <h2 class="section-title">Practice</h2>
      {#if drill}
        <p class="text-ink-300" data-practice-summary>
          {drill.chartCount}
          {drill.chartCount === 1 ? "chart" : "charts"}: {drill.exercises
            .map(describeExercise)
            .join(", then ")}. Finishing marks the lesson as completed.
        </p>
        <div>
          <button class="btn btn-primary btn-lg" onclick={() => (practicing = true)}
            >Start practice</button
          >
        </div>
      {:else if manifest.length > 0}
        <p class="muted">No charts exist for this lesson.</p>
      {:else}
        <p class="muted">Loading…</p>
      {/if}
    </section>

    <nav class="flex flex-wrap justify-between gap-2">
      {#if lessonIndex > 0}
        <button
          class="btn btn-ghost"
          onclick={() => lessonIndex !== null && openLesson(course, lessonIndex - 1)}
          ><span aria-hidden="true">←</span>
          {course.lessons[lessonIndex - 1].title}</button
        >
      {:else}
        <span></span>
      {/if}
      {#if lessonIndex + 1 < course.lessons.length}
        <button
          class="btn btn-ghost"
          onclick={() => lessonIndex !== null && openLesson(course, lessonIndex + 1)}
          >{course.lessons[lessonIndex + 1].title}
          <span aria-hidden="true">→</span></button
        >
      {/if}
    </nav>
  </article>
{:else if course}
  <div class="page page-narrow">
    <header class="flex flex-col gap-3">
      {@render backButton("All courses", () => openCourse(null))}
      <span class="eyebrow">
        {isCustom(course) ? "Your course · " : ""}{gameLabels[course.game] ?? course.game} ·
        {course.stack}bb
      </span>
      <h1 class="page-title">{course.name}</h1>
      {#if course.description}
        <p class="page-lead">{course.description}</p>
      {/if}
    </header>

    <section class="card flex flex-col gap-4">
      {@render progressBar(completedIn(course), course.lessons.length)}
      <div class="flex flex-wrap items-center gap-2">
        <button
          class="btn btn-primary btn-lg"
          onclick={() => openLesson(course, nextLessonIndex(course))}
        >
          {completedIn(course) === 0
            ? "Start course"
            : completedIn(course) === course.lessons.length
              ? "Review from the start"
              : "Continue"}
        </button>
        <div class="ml-auto flex flex-wrap gap-1">
          {#if isCustom(course)}
            <a
              class="btn btn-ghost text-sm"
              href="/course-builder?edit={encodeURIComponent(course.id)}">Edit in course builder</a
            >
            <button class="btn btn-ghost text-sm" onclick={() => removeCourse(course)}
              >Remove course</button
            >
          {/if}
          {#if completedIn(course) > 0}
            <button class="btn btn-ghost text-sm" onclick={() => resetProgress(course)}
              >Reset progress</button
            >
          {/if}
        </div>
      </div>
    </section>

    <ol class="card divide-y divide-ink-800 overflow-hidden p-0">
      {#each course.lessons as item, index (item.id)}
        <li>
          <button
            class="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-ink-850"
            onclick={() => openLesson(course, index)}
          >
            <span
              class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold {isCompleted(
                course,
                item.id
              )
                ? 'bg-accent-500 text-ink-950'
                : 'bg-ink-800 text-ink-300'}"
            >
              {isCompleted(course, item.id) ? "✓" : index + 1}
            </span>
            <span class="flex-1 font-medium">{item.title}</span>
            <span class="text-sm muted">{lessonStack(course, item)}bb</span>
          </button>
        </li>
      {/each}
    </ol>
  </div>
{:else}
  <div class="page">
    <header class="flex flex-col gap-2">
      <span class="eyebrow">Learn</span>
      <h1 class="page-title">Courses</h1>
      <p class="page-lead">
        Step-by-step lessons: a short explanation, the numbers from the charts,
        then practice. Your progress is saved in this browser.
      </p>
    </header>
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {#each courses as item (item.id)}
        {@render courseCard(item)}
      {/each}
    </div>

    <section class="flex flex-col gap-4" data-your-courses>
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="section-title">Your courses</h2>
        <div class="ml-auto flex flex-wrap gap-2">
          <label class="btn btn-secondary">
            Load course file
            <input
              type="file"
              accept=".json,application/json"
              class="hidden"
              onchange={loadCourseFile}
            />
          </label>
          <a href="/course-builder" class="btn btn-primary">Create a course</a>
        </div>
      </div>
      {#if loadMessage}
        <p
          role="status"
          class="text-sm {loadMessage.kind === 'error' ? 'text-red-300' : 'text-emerald-300'}"
          data-load-message
        >
          {loadMessage.text}
        </p>
      {/if}
      {#if customCourses.length === 0}
        <div class="card flex flex-col items-center gap-2 border-dashed py-10 text-center">
          <p class="font-semibold">No courses of your own yet</p>
          <p class="max-w-md text-sm muted">
            Build one in the course builder, or load a course file someone shared
            with you.
          </p>
        </div>
      {:else}
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {#each customCourses as item (item.id)}
            {@render courseCard(item)}
          {/each}
        </div>
      {/if}
    </section>
  </div>
{/if}
