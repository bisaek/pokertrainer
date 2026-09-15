<script lang="ts">
  import { onMount, untrack } from "svelte";
  import CourseFilterEditor from "@components/course/course-filter-editor.svelte";
  import { fetchManifest, type RangeInfo } from "@utils/manifest";
  import type { RangeFilter } from "@utils/drills";
  import {
    COURSE_DRAFT_KEY,
    blankDraft,
    blankExercise,
    blankLesson,
    checkCourse,
    courseFromDraft,
    downloadJson,
    draftFromCourse,
    isCourseDraft,
    loadCustomCourses,
    parseCourse,
    slugify,
    toCourseFile,
    upsertCustomCourse,
    type CourseDraft,
  } from "@utils/course-file";

  const gameLabels: Record<string, string> = { mtt: "MTT", cash: "Cash" };

  let manifest: RangeInfo[] = $state.raw([]);
  let draft: CourseDraft = $state(blankDraft());
  let selected: "course" | number = $state("course");
  let message: { kind: "ok" | "error"; text: string } | null = $state(null);
  let ready = $state(false);

  const games = $derived([...new Set(manifest.map((range) => range.game))]);
  const courseStacks = $derived(stacksFor(draft.game));
  const check = $derived(checkCourse(draft, manifest));

  onMount(() => {
    fetchManifest().then((json) => (manifest = json));
    const editId = new URLSearchParams(window.location.search).get("edit");
    const existing = editId
      ? loadCustomCourses().find((course) => course.id === editId)
      : undefined;
    if (existing) {
      draft = draftFromCourse(existing);
      message = {
        kind: "ok",
        text: `Editing “${existing.name}”. Save to update it in your courses.`,
      };
    } else {
      try {
        const saved = JSON.parse(localStorage.getItem(COURSE_DRAFT_KEY) ?? "null");
        if (isCourseDraft(saved)) draft = saved;
      } catch {
        // Start with a blank course.
      }
    }
    ready = true;
  });

  // The draft as it was when the current message appeared. This effect must stay
  // above the next one so it runs first when a draft and a message change together.
  let messageDraftText = "";
  $effect(() => {
    if (message) messageDraftText = untrack(() => JSON.stringify(draft));
  });

  // Keep the draft across reloads, and clear a message once the draft changes
  // (a "fix this first" message would otherwise outlive the fix).
  $effect(() => {
    const text = JSON.stringify(draft);
    if (!ready) return;
    try {
      localStorage.setItem(COURSE_DRAFT_KEY, text);
    } catch {
      // Storage is full or blocked; the draft lasts until the page is closed.
    }
    untrack(() => {
      if (message && text !== messageDraftText) message = null;
    });
  });

  function stacksFor(game: string) {
    return [
      ...new Set(manifest.filter((range) => range.game === game).map((range) => range.stack)),
    ].sort((a, b) => a - b);
  }

  function setGame(game: string) {
    draft.game = game;
    const stacks = stacksFor(game);
    if (stacks.length > 0 && !stacks.includes(draft.stack)) {
      draft.stack = Math.max(...stacks);
    }
    for (const lesson of draft.lessons) {
      if (lesson.stack !== null && !stacks.includes(lesson.stack)) lesson.stack = null;
    }
  }

  // The course to save or download, or null (with a message) if it has problems.
  function validCourse() {
    if (check.errors.length > 0) {
      message = {
        kind: "error",
        text:
          check.errors.length === 1
            ? `Fix this first: ${check.errors[0]}`
            : `Fix the ${check.errors.length} problems listed below first.`,
      };
      return null;
    }
    const result = parseCourse(toCourseFile(courseFromDraft(draft)));
    if ("errors" in result) {
      message = { kind: "error", text: result.errors[0] };
      return null;
    }
    return result.course;
  }

  function saveToMyCourses() {
    const course = validCourse();
    if (!course) return;
    const existed = loadCustomCourses().some((item) => item.id === course.id);
    upsertCustomCourse(course);
    message = {
      kind: "ok",
      text: `${existed ? "Updated" : "Saved"} “${course.name}” in your courses.`,
    };
  }

  function download() {
    const course = validCourse();
    if (!course) return;
    const filename = `${slugify(course.name) || "course"}.json`;
    downloadJson(filename, toCourseFile(course));
    message = { kind: "ok", text: `Downloaded ${filename}.` };
  }

  async function importFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const result = parseCourse(JSON.parse(await file.text()));
      if ("errors" in result) {
        message = {
          kind: "error",
          text: `Couldn't import ${file.name}: ${result.errors.slice(0, 3).join(" ")}`,
        };
      } else {
        draft = draftFromCourse(result.course);
        selected = "course";
        message = { kind: "ok", text: `Imported “${result.course.name}”.` };
      }
    } catch {
      message = { kind: "error", text: `Couldn't import ${file.name}: it isn't valid JSON.` };
    } finally {
      input.value = "";
    }
  }

  function newCourse() {
    if (!confirm("Start a new course? This replaces the current draft, so save or download it first.")) {
      return;
    }
    draft = blankDraft();
    selected = "course";
    message = null;
  }

  function addLesson() {
    draft.lessons.push(blankLesson(draft.lessons.length + 1));
    selected = draft.lessons.length - 1;
  }

  function removeLesson(index: number) {
    const lesson = draft.lessons[index];
    if (draft.lessons.length === 1) return;
    if (!confirm(`Remove “${lesson.title || "Untitled lesson"}”?`)) return;
    draft.lessons.splice(index, 1);
    selected = Math.max(0, index - 1);
  }

  function moveLesson(index: number, by: number) {
    const target = index + by;
    if (target < 0 || target >= draft.lessons.length) return;
    const [lesson] = draft.lessons.splice(index, 1);
    draft.lessons.splice(target, 0, lesson);
    if (selected === index) selected = target;
    else if (selected === target) selected = index;
  }
</script>

<div class="page">
  <header class="flex flex-col gap-2">
    <span class="eyebrow">Tools</span>
    <h1 class="page-title">Course builder</h1>
    <p class="page-lead">
      Build your own course from the charts. Save it to practice on the Courses
      page, or download it as a JSON file to share.
    </p>
  </header>

  <div class="card flex flex-wrap items-center gap-2">
    <button class="btn btn-primary" onclick={saveToMyCourses}>Save to my courses</button>
    <button class="btn btn-secondary" onclick={download}>Download JSON</button>
    <label class="btn btn-secondary">
      Import JSON
      <input
        type="file"
        accept=".json,application/json"
        class="hidden"
        onchange={importFile}
      />
    </label>
    <button class="btn btn-ghost" onclick={newCourse}>New course</button>
    <a href="/courses" class="btn btn-ghost ml-auto">Go to courses <span aria-hidden="true">→</span></a>
  </div>

  {#if message}
    <p
      role="status"
      class="text-sm {message.kind === 'error' ? 'text-red-300' : 'text-emerald-300'}"
      data-builder-message
    >
      {message.text}
    </p>
  {/if}

  {#if check.errors.length > 0 || check.warnings.length > 0}
    <section
      class="card flex flex-col gap-1.5 {check.errors.length > 0 ? 'border-red-500/40' : ''}"
      data-course-checks
    >
      {#each check.errors as error}
        <p class="text-sm text-red-300">{error}</p>
      {/each}
      {#each check.warnings as warning}
        <p class="text-sm text-orange-300">{warning}</p>
      {/each}
    </section>
  {:else if manifest.length > 0}
    <p class="text-sm text-emerald-300" data-course-checks>
      Every exercise has charts. Ready to save.
    </p>
  {/if}

  <div class="grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
    <nav class="card flex flex-col gap-1 p-2 lg:sticky lg:top-20" aria-label="Course outline" data-outline>
      <button
        class="rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors {selected === 'course'
          ? 'bg-ink-800 text-accent-300'
          : 'text-ink-300 hover:bg-ink-850'}"
        onclick={() => (selected = "course")}>Course details</button
      >
      <span class="label px-3 pt-3 pb-1">Lessons</span>
      {#each draft.lessons as item, index (item.id)}
        <div class="flex items-center gap-0.5" data-outline-lesson>
          <button
            class="min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-left text-sm transition-colors {selected === index
              ? 'bg-ink-800 text-accent-300'
              : 'text-ink-300 hover:bg-ink-850'}"
            onclick={() => (selected = index)}
          >
            <span class="mr-1 tabular-nums muted">{index + 1}.</span>
            {item.title || "Untitled lesson"}
          </button>
          <button
            class="btn btn-ghost px-2 py-1"
            aria-label="Move lesson {index + 1} up"
            disabled={index === 0}
            onclick={() => moveLesson(index, -1)}>↑</button
          >
          <button
            class="btn btn-ghost px-2 py-1"
            aria-label="Move lesson {index + 1} down"
            disabled={index === draft.lessons.length - 1}
            onclick={() => moveLesson(index, 1)}>↓</button
          >
        </div>
      {/each}
      <button class="btn btn-ghost mt-1 justify-start" onclick={addLesson}>+ Add lesson</button>
    </nav>

    <div class="flex min-w-0 flex-col gap-5">
      {#if selected === "course"}
        <section class="card flex flex-col gap-4" data-course-editor>
          <h2 class="section-title">Course details</h2>
          <label class="flex flex-col gap-2">
            <span class="label">Name</span>
            <input class="input" bind:value={draft.name} placeholder="My preflop course" />
          </label>
          <label class="flex flex-col gap-2">
            <span class="label">Description</span>
            <textarea
              class="input min-h-20"
              bind:value={draft.description}
              placeholder="Who is this course for, and what does it cover?"
            ></textarea>
          </label>
          <div class="flex flex-col gap-2">
            <span class="label">Game</span>
            <div class="flex flex-wrap gap-1.5">
              {#each games as game}
                <button
                  type="button"
                  class="chip {draft.game === game ? 'chip-active' : ''}"
                  onclick={() => setGame(game)}>{gameLabels[game] ?? game}</button
                >
              {/each}
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <span class="label">Default stack</span>
            <div class="flex flex-wrap gap-1.5">
              {#each courseStacks as stack}
                <button
                  type="button"
                  class="chip {draft.stack === stack ? 'chip-active' : ''}"
                  onclick={() => (draft.stack = stack)}>{stack}bb</button
                >
              {/each}
            </div>
            <p class="text-xs muted">Lessons use this stack unless they pick their own.</p>
          </div>
        </section>
      {/if}

      {#each draft.lessons as lesson, index (lesson.id)}
        {#if selected === index}
          <div class="flex flex-col gap-5" data-lesson-editor>
            <section class="card flex flex-col gap-4">
              <div class="flex items-center gap-3">
                <h2 class="section-title flex-1">Lesson {index + 1}</h2>
                <button
                  class="btn btn-ghost text-sm"
                  disabled={draft.lessons.length === 1}
                  onclick={() => removeLesson(index)}>Remove lesson</button
                >
              </div>
              <label class="flex flex-col gap-2">
                <span class="label">Title</span>
                <input class="input" bind:value={lesson.title} />
              </label>
              <div class="flex flex-col gap-2">
                <span class="label">Stack</span>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    class="chip {lesson.stack === null ? 'chip-active' : ''}"
                    onclick={() => (lesson.stack = null)}>Course default ({draft.stack}bb)</button
                  >
                  {#each courseStacks as stack}
                    <button
                      type="button"
                      class="chip {lesson.stack === stack ? 'chip-active' : ''}"
                      onclick={() => (lesson.stack = stack)}>{stack}bb</button
                    >
                  {/each}
                </div>
              </div>
              <label class="flex flex-col gap-2">
                <span class="label">Explanation</span>
                <textarea
                  class="input min-h-40 leading-relaxed"
                  bind:value={lesson.bodyText}
                  placeholder="What should the player learn? Separate paragraphs with a blank line."
                ></textarea>
              </label>
            </section>

            <section class="card flex flex-col gap-4" data-stats-editor>
              <label class="flex items-center gap-3">
                <input
                  type="checkbox"
                  class="h-4 w-4 accent-accent-500"
                  bind:checked={lesson.statsEnabled}
                />
                <span class="font-medium">Show a chart table</span>
              </label>
              <p class="-mt-2 text-sm muted">
                Shows how the matching charts split their hands between actions,
                under the explanation.
              </p>
              {#if lesson.statsEnabled}
                <CourseFilterEditor
                  {manifest}
                  game={draft.game}
                  stack={lesson.stack ?? draft.stack}
                  filter={lesson.stats}
                  onchange={(next: RangeFilter) => (lesson.stats = next)}
                />
              {/if}
            </section>

            <section class="flex flex-col gap-3">
              <h3 class="section-title">Practice</h3>
              {#each lesson.exercises as exercise, exerciseIndex}
                <div class="card flex flex-col gap-4" data-exercise={exerciseIndex}>
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="label mr-1">Exercise {exerciseIndex + 1}</span>
                    <button
                      type="button"
                      class="chip {exercise.kind === 'range' ? 'chip-active' : ''}"
                      onclick={() => (exercise.kind = "range")}>Rebuild charts</button
                    >
                    <button
                      type="button"
                      class="chip {exercise.kind === 'hands' ? 'chip-active' : ''}"
                      onclick={() => (exercise.kind = "hands")}>Hand quiz</button
                    >
                    <button
                      class="btn btn-ghost ml-auto text-sm"
                      disabled={lesson.exercises.length === 1}
                      onclick={() => lesson.exercises.splice(exerciseIndex, 1)}>Remove</button
                    >
                  </div>
                  {#if exercise.kind === "range"}
                    <label class="flex items-center gap-3">
                      <span class="label">Correct in a row</span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        class="input w-24"
                        bind:value={exercise.timesInARow}
                      />
                    </label>
                  {:else}
                    <label class="flex items-center gap-3">
                      <span class="label">Hands</span>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        class="input w-24"
                        bind:value={exercise.count}
                      />
                    </label>
                  {/if}
                  <CourseFilterEditor
                    {manifest}
                    game={draft.game}
                    stack={lesson.stack ?? draft.stack}
                    filter={exercise.filter}
                    onchange={(next: RangeFilter) => (exercise.filter = next)}
                  />
                </div>
              {/each}
              <div class="flex flex-wrap gap-2">
                <button
                  class="btn btn-secondary"
                  onclick={() =>
                    lesson.exercises.push(blankExercise("range", lesson.exercises.at(-1)?.filter))}
                  >+ Rebuild exercise</button
                >
                <button
                  class="btn btn-secondary"
                  onclick={() =>
                    lesson.exercises.push(blankExercise("hands", lesson.exercises.at(-1)?.filter))}
                  >+ Hand quiz</button
                >
              </div>
            </section>
          </div>
        {/if}
      {/each}
    </div>
  </div>
</div>
