<script lang="ts">
  import { onMount } from "svelte";
  import { fetchManifest, type RangeInfo } from "@utils/manifest";
  import { describeExercise, resolveDrill } from "@utils/drills";
  import { loadCustomDrills, newDrillId, type CustomDrill } from "@utils/custom-drills";
  import {
    loadCustomCourses,
    newCourseId,
    saveCustomCourse,
    type CustomCourse,
    type CustomLesson,
    type LessonPractice,
  } from "@utils/custom-courses";
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

  // A form that makes a course: a game and stack, then lessons that each have
  // some text and one or more drills as practice. A lesson's drill is one
  // saved under "Your drills", or one made right here, which stays in the
  // course. Opening /courses/new?edit=<id> changes a saved course instead.
  const gameLabels: Record<string, string> = { mtt: "MTT", cash: "Cash" };

  type PracticeDraft =
    | { kind: "saved"; drillId: string }
    | { kind: "own"; id: string; name: string; exercises: ExerciseDraft[] };
  type LessonDraft = { id: string; title: string; text: string; practice: PracticeDraft[] };

  let manifest: RangeInfo[] = $state.raw([]);
  let drills: CustomDrill[] = $state.raw([]);
  let loaded = $state(false);
  let editId: string | null = $state(null);
  let name = $state("");
  let description = $state("");
  let game = $state("cash");
  let stack = $state(100);
  let lessons: LessonDraft[] = $state([blankLesson()]);
  let showErrors = $state(false);

  const games = $derived([...new Set(manifest.map((range) => range.game))]);
  const stacks = $derived(
    [...new Set(manifest.filter((range) => range.game === game).map((range) => range.stack))].sort(
      (a, b) => a - b
    )
  );
  // The drills a lesson can use: the player's own, for this game and stack.
  const available = $derived(
    drills.filter((drill) => drill.game === game && drill.stack === stack)
  );
  const newDrillUrl = $derived(
    `/drills/new?${new URLSearchParams({ game, stack: String(stack) })}`
  );

  const errors = $derived.by(() => {
    const list: string[] = [];
    if (name.trim() === "") list.push("Give the course a name.");
    if (lessons.length === 0) list.push("Add at least one lesson.");
    lessons.forEach((lesson, index) => {
      if (lesson.title.trim() === "") list.push(`Lesson ${index + 1} needs a title.`);
      if (lesson.practice.length === 0) list.push(`Lesson ${index + 1} needs a drill.`);
      lesson.practice.forEach((item, drillIndex) => {
        if (item.kind !== "own") return;
        for (const error of exerciseErrors(item.exercises, manifest, game, stack)) {
          list.push(`Lesson ${index + 1}, drill ${drillIndex + 1}: ${error}`);
        }
      });
    });
    return list;
  });

  onMount(async () => {
    drills = loadCustomDrills();
    const json = await fetchManifest();
    manifest = json;
    const params = readParams();
    const saved = loadCustomCourses().find((course) => course.id === params.get("edit"));
    if (saved) {
      editId = saved.id;
      name = saved.name;
      description = saved.description;
      game = saved.game;
      stack = saved.stack;
      lessons = saved.lessons.map(lessonDraftOf);
    } else {
      game = json.some((range) => range.game === game) ? game : (json[0]?.game ?? game);
      const stacks = json.filter((range) => range.game === game).map((range) => range.stack);
      if (!stacks.includes(stack)) stack = Math.max(...stacks, 0);
    }
    loaded = true;
  });

  function blankLesson(): LessonDraft {
    return { id: newCourseId(), title: "", text: "", practice: [] };
  }

  function lessonDraftOf(lesson: CustomLesson): LessonDraft {
    return {
      id: lesson.id,
      title: lesson.title,
      text: lesson.body.join("\n\n"),
      practice: lesson.practice.map((item) =>
        item.kind === "saved"
          ? { kind: "saved", drillId: item.drillId }
          : {
              kind: "own",
              id: item.drill.id,
              name: item.drill.name,
              exercises: item.drill.exercises.map(draftOf),
            }
      ),
    };
  }

  function practiceOf(item: PracticeDraft, lesson: LessonDraft, index: number): LessonPractice {
    if (item.kind === "saved") return item;
    return {
      kind: "own",
      drill: {
        id: item.id,
        name: item.name.trim() || `${lesson.title.trim() || "Lesson"} drill ${index + 1}`,
        description: "",
        game,
        stack,
        exercises: item.exercises.map(templateOf),
      },
    };
  }

  // Paragraphs are separated by a blank line.
  function lessonOf(lesson: LessonDraft): CustomLesson {
    return {
      id: lesson.id,
      title: lesson.title.trim(),
      body: lesson.text
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
        .filter((paragraph) => paragraph !== ""),
      practice: lesson.practice
        .filter((item) => item.kind === "own" || available.some((drill) => drill.id === item.drillId))
        .map((item, index) => practiceOf(item, lesson, index)),
    };
  }

  function drillById(id: string): CustomDrill | undefined {
    return drills.find((drill) => drill.id === id);
  }

  function describeDrill(drill: CustomDrill): string {
    const resolved = resolveDrill(drill, manifest, drill.game, drill.stack);
    if (!resolved) return "no charts";
    return `${resolved.chartCount} ${resolved.chartCount === 1 ? "chart" : "charts"} · ${resolved.exercises
      .map(describeExercise)
      .join(", then ")}`;
  }

  function selectGame(next: string) {
    if (next === game) return;
    game = next;
    const stacks = manifest.filter((range) => range.game === game).map((range) => range.stack);
    if (!stacks.includes(stack)) stack = Math.max(...stacks, 0);
    clearDrills();
  }

  function selectStack(next: number) {
    stack = next;
    clearDrills();
  }

  // Another game or stack has other drills and charts: saved drills leave the
  // lessons, and a lesson's own drills lose their picks.
  function clearDrills() {
    for (const lesson of lessons) {
      lesson.practice = lesson.practice.filter((item) => item.kind === "own");
      for (const item of lesson.practice) {
        if (item.kind !== "own") continue;
        for (const exercise of item.exercises) exercise.picks = [blankPick()];
      }
    }
  }

  function addLesson() {
    lessons.push(blankLesson());
  }

  function removeLesson(index: number) {
    lessons.splice(index, 1);
  }

  function move<T>(list: T[], index: number, by: number) {
    const target = index + by;
    if (target < 0 || target >= list.length) return;
    const [item] = list.splice(index, 1);
    list.splice(target, 0, item);
  }

  function addDrill(lesson: LessonDraft, event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    if (select.value) lesson.practice.push({ kind: "saved", drillId: select.value });
    select.value = "";
  }

  // A drill made in the lesson: it is kept in the course, not under "Your drills".
  function addOwnDrill(lesson: LessonDraft) {
    lesson.practice.push({
      kind: "own",
      id: newDrillId(),
      name: "",
      exercises: [blankExercise("range")],
    });
  }

  function save() {
    if (errors.length > 0) {
      showErrors = true;
      return;
    }
    const course: CustomCourse = {
      id: editId ?? newCourseId(),
      name: name.trim(),
      description: description.trim(),
      game,
      stack,
      lessons: lessons.map(lessonOf),
    };
    saveCustomCourse(course);
    window.location.href = `/courses?${new URLSearchParams({ course: course.id })}`;
  }
</script>

<div class="page page-narrow">
  <header class="flex flex-col gap-2">
    <a href="/courses" class="btn btn-ghost -ml-3 self-start">
      <span aria-hidden="true">←</span>
      Back to courses
    </a>
    <span class="eyebrow">Learn</span>
    <h1 class="page-title">{editId ? "Edit course" : "Create a course"}</h1>
    <p class="page-lead">
      Write lessons and give each a drill as practice: one of yours, or one made
      for the lesson. The course is kept in this browser and shows up under "Your courses".
    </p>
  </header>

  {#if !loaded}
    <p class="py-12 text-center muted">Loading…</p>
  {:else}
    <section class="card flex flex-col gap-4">
      <label class="flex flex-col gap-1.5">
        <span class="label">Name</span>
        <input class="input" bind:value={name} placeholder="Opening ranges" maxlength="60" />
      </label>
      <label class="flex flex-col gap-1.5">
        <span class="label">Description <span class="font-normal normal-case tracking-normal text-ink-600">(optional)</span></span>
        <input class="input" bind:value={description} placeholder="Every seat's open, one lesson at a time." maxlength="160" />
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
      {#if available.length === 0}
        <p class="text-sm muted" data-no-drills>
          You have no saved drills for {gameLabels[game] ?? game} {stack}bb. A lesson can
          still make its own, or <a href={newDrillUrl} class="link">create a drill</a> to share
          between lessons.
        </p>
      {/if}
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="section-title">Lessons</h2>
      {#each lessons as lesson, index (lesson.id)}
        <div class="card flex flex-col gap-4" data-lesson>
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-semibold text-ink-100">Lesson {index + 1}</span>
            <div class="ml-auto flex items-center gap-1">
              <button class="btn btn-ghost py-1" onclick={() => move(lessons, index, -1)} disabled={index === 0} aria-label="Move up">↑</button>
              <button class="btn btn-ghost py-1" onclick={() => move(lessons, index, 1)} disabled={index === lessons.length - 1} aria-label="Move down">↓</button>
              <button class="btn btn-ghost py-1" onclick={() => removeLesson(index)}>Remove</button>
            </div>
          </div>

          <label class="flex flex-col gap-1.5">
            <span class="label">Title</span>
            <input class="input" bind:value={lesson.title} placeholder="Opening from the button" maxlength="80" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="label">Text <span class="font-normal normal-case tracking-normal text-ink-600">(optional; a blank line starts a new paragraph)</span></span>
            <textarea class="input min-h-32" bind:value={lesson.text} placeholder="What to notice about these charts."></textarea>
          </label>

          <div class="flex flex-col gap-2">
            <span class="label">Practice</span>
            {#if lesson.practice.length > 0}
              <ol class="flex flex-col gap-2" data-lesson-drills>
                {#each lesson.practice as item, drillIndex (item.kind === "saved" ? item.drillId : item.id)}
                  <li
                    class="flex flex-col gap-3 rounded-xl border border-ink-700 bg-ink-850/60 px-3 py-2"
                    data-practice={item.kind}
                  >
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {#if item.kind === "saved"}
                        {@const drill = drillById(item.drillId)}
                        <span class="text-sm font-medium">{drill?.name ?? "A deleted drill"}</span>
                        {#if drill}
                          <span class="text-xs muted">{describeDrill(drill)}</span>
                        {/if}
                      {:else}
                        <input
                          class="input max-w-xs"
                          bind:value={item.name}
                          placeholder="Name this drill"
                          maxlength="60"
                        />
                        <span class="text-xs muted">Kept in this course</span>
                      {/if}
                      <div class="ml-auto flex items-center gap-1">
                        <button class="btn btn-ghost py-1" onclick={() => move(lesson.practice, drillIndex, -1)} disabled={drillIndex === 0} aria-label="Move up">↑</button>
                        <button class="btn btn-ghost py-1" onclick={() => move(lesson.practice, drillIndex, 1)} disabled={drillIndex === lesson.practice.length - 1} aria-label="Move down">↓</button>
                        <button class="btn btn-ghost py-1" onclick={() => lesson.practice.splice(drillIndex, 1)}>Remove</button>
                      </div>
                    </div>
                    {#if item.kind === "own"}
                      <DrillExercises {manifest} {game} {stack} bind:exercises={item.exercises} />
                    {/if}
                  </li>
                {/each}
              </ol>
            {/if}
            <div class="flex flex-wrap items-center gap-2">
              <select class="input max-w-sm" onchange={(event) => addDrill(lesson, event)} disabled={available.length === 0}>
                <option value="">{lesson.practice.length === 0 ? "Pick a drill…" : "Add another drill…"}</option>
                {#each available as drill (drill.id)}
                  <option value={drill.id}>{drill.name}</option>
                {/each}
              </select>
              <button class="btn btn-secondary" onclick={() => addOwnDrill(lesson)}>+ New drill</button>
            </div>
          </div>
        </div>
      {/each}

      <div>
        <button class="btn btn-secondary" onclick={addLesson}>+ Add a lesson</button>
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
        {editId ? "Save changes" : "Save course"}
      </button>
      <a href="/courses" class="btn btn-ghost btn-lg">Cancel</a>
    </div>
  {/if}
</div>
