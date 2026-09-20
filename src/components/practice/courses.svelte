<script lang="ts">
  import { onMount } from "svelte";
  import DrillRunner from "./drill-runner.svelte";
  import { getButtonClass, type Action } from "@utils/range.svelte";
  import { fetchChart, fetchManifest, type RangeInfo } from "@utils/manifest";
  import { describeExercise } from "@utils/drills";
  import { ACTION_ORDER, actionShares, type ActionShare } from "@utils/chart-stats";
  import {
    courses,
    lessonStack,
    lessonStatsUrls,
    resolveLesson,
    type Course,
  } from "@utils/courses";
  import { onUrlChange, readParams, writeParams } from "@utils/url-state";
  import {
    importCustomDrills,
    loadCustomDrills,
    type CustomDrill,
  } from "@utils/custom-drills";
  import {
    downloadCourses,
    fetchCourseFiles,
    importCustomCourses,
    loadCustomCourses,
    parseCourseFile,
    removeCustomCourse,
    toCourse,
    type CustomCourse,
  } from "@utils/custom-courses";

  const PROGRESS_KEY = "pokertrainer.courses.v1";
  const gameLabels: Record<string, string> = { mtt: "Tournament", cash: "Cash" };

  // Course id -> ids of the lessons completed.
  type Progress = Record<string, string[]>;
  type StatsRow = { name: string; reach: number; shares: ActionShare[] };

  let manifest: RangeInfo[] = $state.raw([]);
  let manifestReady: Promise<RangeInfo[]> = Promise.resolve([]);
  let progress: Progress = $state.raw({});
  // The player's own courses, kept in this browser, shown after the built-in ones.
  let customCourses: CustomCourse[] = $state.raw([]);
  let customDrills: CustomDrill[] = $state.raw([]);
  // Courses from files in public/courses: built in, like the ones in courses.ts.
  let fileCourses: Course[] = $state.raw([]);
  let uploadMessage: string | null = $state(null);
  // The open course, lesson and whether practice is running live in the URL
  // (?course=cash-100&lesson=position&practice=1) so a copied link opens the same view.
  let courseId: string | null = $state(null);
  let lessonIndex: number | null = $state(null);
  let practicing = $state(false);
  let stats: StatsRow[] = $state.raw([]);
  let statsLoading = $state(false);
  let statsToken = 0;

  const builtIn = $derived([...courses, ...fileCourses]);
  // A course that has since become a file is shown once, as built in.
  const ownCourses = $derived(
    customCourses
      .filter((item) => !fileCourses.some((course) => course.id === item.id))
      .map((item) => toCourse(item, customDrills))
  );
  const allCourses = $derived([...builtIn, ...ownCourses]);
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
    customDrills = loadCustomDrills();
    customCourses = loadCustomCourses();
    manifestReady = fetchManifest().then((json) => (manifest = json));
    readUrl();
    // A link to a course from a file can only be followed once the files are in.
    fetchCourseFiles()
      .then((loaded) => {
        fileCourses = loaded;
        if (courseId === null) readUrl();
      })
      .catch((error) => console.error(error));
    return onUrlChange(readUrl);
  });

  function readUrl() {
    const params = readParams();
    const c = allCourses.find((item) => item.id === params.get("course")) ?? null;
    const index = c ? c.lessons.findIndex((l) => l.id === params.get("lesson")) : -1;
    courseId = c?.id ?? null;
    lessonIndex = index === -1 ? null : index;
    practicing = lessonIndex !== null && params.get("practice") === "1";
    if (c && lessonIndex !== null) loadStats(c, lessonIndex);
  }

  function writeUrl() {
    writeParams(
      {
        course: courseId,
        lesson: course && lessonIndex !== null ? course.lessons[lessonIndex]?.id : null,
        practice: practicing ? "1" : null,
      },
      "push"
    );
  }

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
    writeUrl();
    window.scrollTo(0, 0);
  }

  function openLesson(c: Course, index: number) {
    courseId = c.id;
    lessonIndex = index;
    practicing = false;
    writeUrl();
    window.scrollTo(0, 0);
    loadStats(c, index);
  }

  function setPracticing(value: boolean) {
    practicing = value;
    writeUrl();
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
    try {
      const charts = (await Promise.all(
        lessonStatsUrls(c, target, loaded).map((url) => fetchChart(url))
      )) as { name: string; range: (string | null)[] }[];
      // Ignore stats for a lesson that is no longer open.
      if (token !== statsToken) return;
      stats = charts.map((chart) => ({ name: chart.name, ...actionShares(chart.range) }));
    } catch (error) {
      // The table is extra information; the lesson still works without it.
      console.error(error);
      if (token !== statsToken) return;
      stats = [];
    }
    statsLoading = false;
  }

  function deleteCourse(c: Course) {
    if (!confirm(`Delete "${c.name}"?`)) return;
    customCourses = removeCustomCourse(c.id);
    const { [c.id]: _, ...rest } = progress;
    progress = rest;
    saveProgress();
    if (courseId === c.id) openCourse(null);
  }

  function downloadCourse(c: Course) {
    const saved = customCourses.find((item) => item.id === c.id);
    if (saved) downloadCourses([saved], saved.name);
  }

  function downloadAll() {
    downloadCourses(customCourses, "courses");
  }

  // A course file brings its drills along; they go in with the saved drills.
  async function uploadFiles(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = "";
    if (files.length === 0) return;
    let added = 0;
    let replaced = 0;
    let drillCount = 0;
    const problems: string[] = [];
    for (const file of files) {
      try {
        const parsed = parseCourseFile(await file.text());
        const drills = importCustomDrills(parsed.drills);
        customDrills = drills.drills;
        drillCount += drills.added;
        const result = importCustomCourses(parsed.courses);
        customCourses = result.courses;
        added += result.added;
        replaced += result.replaced;
      } catch (error) {
        problems.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    const parts: string[] = [];
    if (added > 0) parts.push(`Added ${added} ${added === 1 ? "course" : "courses"}.`);
    if (replaced > 0) parts.push(`Replaced ${replaced} ${replaced === 1 ? "course" : "courses"} already saved.`);
    if (drillCount > 0) parts.push(`${drillCount} ${drillCount === 1 ? "drill" : "drills"} came along and went in with your drills.`);
    uploadMessage = [...parts, ...problems].join(" ");
  }

  function percentFor(row: StatsRow, action: string) {
    const share = row.shares.find((s) => s.action === action);
    return share ? `${share.percent.toFixed(1)}%` : "–";
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

{#if course && lesson && practicing && drill}
  <DrillRunner
    {drill}
    backLabel="Back to lesson"
    onback={() => setPracticing(false)}
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

    <div class="flex flex-col gap-4 text-lg leading-relaxed text-ink-300">
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
          <button class="btn btn-primary btn-lg" onclick={() => setPracticing(true)}
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
      <span class="eyebrow">{gameLabels[course.game] ?? course.game} · {course.stack}bb</span>
      <h1 class="page-title">{course.name}</h1>
      <p class="page-lead">{course.description}</p>
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
        {#if completedIn(course) > 0}
          <button class="btn btn-ghost ml-auto text-sm" onclick={() => resetProgress(course)}
            >Reset progress</button
          >
        {/if}
      </div>
    </section>

    {#if course.custom}
      <div class="flex flex-col gap-2" data-course-actions>
        <div class="flex flex-wrap gap-1">
          <a href="/courses/new?edit={encodeURIComponent(course.id)}" class="btn btn-ghost">Edit</a>
          <button class="btn btn-ghost" onclick={() => downloadCourse(course)}>Download</button>
          <button class="btn btn-ghost" onclick={() => deleteCourse(course)}>Delete</button>
        </div>
        <p class="text-xs muted">
          To make this a built-in course, download it and put the file in
          <code>public/courses/</code>, like a chart file in <code>public/ranges/</code>.
        </p>
      </div>
    {/if}

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
      {#each builtIn as item (item.id)}
        {@render courseCard(item)}
      {/each}
    </div>

    <section class="flex flex-col gap-3" data-own-courses>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 class="section-title flex items-baseline gap-2">
          Your courses
          {#if ownCourses.length > 0}
            <span class="text-sm font-normal muted">{ownCourses.length}</span>
          {/if}
        </h2>
        <div class="ml-auto flex flex-wrap items-center gap-2">
          <label class="btn btn-ghost">
            Upload
            <input
              type="file"
              accept=".json,application/json"
              multiple
              class="hidden"
              onchange={uploadFiles}
            />
          </label>
          <button class="btn btn-ghost" disabled={customCourses.length === 0} onclick={downloadAll}>
            Download all
          </button>
          <a href="/courses/new" class="btn btn-secondary">+ Create a course</a>
        </div>
      </div>
      {#if uploadMessage}
        <p class="text-sm text-ink-300" data-upload-message>{uploadMessage}</p>
      {/if}
      {#if ownCourses.length === 0}
        <p class="text-sm muted">
          Write your own lessons, with your drills as the practice, or upload a course
          file someone shared.
        </p>
      {:else}
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {#each ownCourses as item (item.id)}
            {@render courseCard(item)}
          {/each}
        </div>
      {/if}
    </section>
  </div>
{/if}

{#snippet courseCard(item: Course)}
  <button
    class="card card-interactive flex flex-col gap-3"
    onclick={() => openCourse(item)}
  >
    <span class="label">
      {gameLabels[item.game] ?? item.game} · {item.stack}bb · {item.lessons.length}
      {item.lessons.length === 1 ? "lesson" : "lessons"}
    </span>
    <span class="text-xl font-semibold text-ink-100" data-course-name>{item.name}</span>
    <span class="flex-1 text-sm text-ink-300">{item.description}</span>
    {@render progressBar(completedIn(item), item.lessons.length)}
  </button>
{/snippet}
