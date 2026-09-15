// Course files: the JSON the course builder downloads and the Courses page loads,
// plus the user's own courses saved in the browser.
//
// A course file is a course (see Course in courses.ts) with a format marker:
//   { "format": "pokertrainer-course", "version": 1, "id": "...", "name": "...",
//     "description": "...", "game": "cash", "stack": 100, "lessons": [...] }

import { courses as builtInCourses, type Course, type Lesson } from "./courses";
import { resolveUrls, type ExerciseTemplate, type RangeFilter } from "./drills";
import type { RangeInfo } from "./manifest";

export const COURSE_FORMAT = "pokertrainer-course";
export const COURSE_VERSION = 1;
export const CUSTOM_COURSES_KEY = "pokertrainer.custom-courses.v1";
export const COURSE_DRAFT_KEY = "pokertrainer.course-draft.v1";

const MAX_STACK = 10000;
const MAX_TIMES_IN_A_ROW = 10;
const MAX_HANDS = 500;
const BUILT_IN_IDS = builtInCourses.map((course) => course.id);

export type CourseFile = { format: string; version: number } & Course;

// The course builder edits this form: a lesson's paragraphs are one text box, and
// optional parts keep their last value while switched off.
export type ExerciseDraft = {
  kind: "range" | "hands";
  filter: RangeFilter;
  timesInARow: number;
  count: number;
};
export type LessonDraft = {
  id: string;
  title: string;
  stack: number | null;
  bodyText: string;
  statsEnabled: boolean;
  stats: RangeFilter;
  exercises: ExerciseDraft[];
};
export type CourseDraft = {
  id: string;
  name: string;
  description: string;
  game: string;
  stack: number;
  lessons: LessonDraft[];
};

// ---------------------------------------------------------------------------
// Ids

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 7);
}

// Ids stay the same when a course is renamed, so saved progress keeps working.
export function newCourseId(name: string) {
  return `custom-${slugify(name) || "course"}-${randomSuffix()}`;
}

export function newLessonId() {
  return `lesson-${randomSuffix()}`;
}

// ---------------------------------------------------------------------------
// Writing

function copyFilter(filter: RangeFilter): RangeFilter {
  return {
    types: [...filter.types],
    ...(filter.positions?.length ? { positions: [...filter.positions] } : {}),
    ...(filter.opponents?.length ? { opponents: [...filter.opponents] } : {}),
  };
}

function copyExercise(exercise: ExerciseTemplate): ExerciseTemplate {
  return exercise.kind === "range"
    ? { kind: "range", filter: copyFilter(exercise.filter), timesInARow: exercise.timesInARow }
    : { kind: "hands", filter: copyFilter(exercise.filter), count: exercise.count };
}

export function toCourseFile(course: Course): CourseFile {
  return {
    format: COURSE_FORMAT,
    version: COURSE_VERSION,
    id: course.id,
    name: course.name,
    description: course.description,
    game: course.game,
    stack: course.stack,
    lessons: course.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      ...(lesson.stack !== undefined ? { stack: lesson.stack } : {}),
      body: [...lesson.body],
      ...(lesson.stats ? { stats: copyFilter(lesson.stats) } : {}),
      exercises: lesson.exercises.map(copyExercise),
    })),
  };
}

// ---------------------------------------------------------------------------
// Reading

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown, label: string, errors: string[], required: boolean) {
  if (value === undefined || value === null || (value === "" && required)) {
    if (required) errors.push(`${label} is missing.`);
    return undefined;
  }
  if (typeof value !== "string") {
    errors.push(`${label} must be text.`);
    return undefined;
  }
  const trimmed = value.trim();
  if (required && !trimmed) {
    errors.push(`${label} is missing.`);
    return undefined;
  }
  return trimmed;
}

function readInteger(value: unknown, label: string, min: number, max: number, errors: string[]) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    errors.push(`${label} must be a whole number from ${min} to ${max}.`);
    return undefined;
  }
  return value;
}

function readTextList(value: unknown, label: string, errors: string[]) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    errors.push(`${label} must be a list of text.`);
    return undefined;
  }
  return value as string[];
}

function readFilter(value: unknown, label: string, errors: string[]): RangeFilter | undefined {
  if (!isObject(value)) {
    errors.push(`${label} is missing its charts.`);
    return undefined;
  }
  const types = readTextList(value.types, `${label} situations`, errors);
  if (types && types.length === 0) errors.push(`${label} needs at least one situation.`);
  const positions =
    value.positions === undefined ? undefined : readTextList(value.positions, `${label} positions`, errors);
  const opponents =
    value.opponents === undefined ? undefined : readTextList(value.opponents, `${label} opponents`, errors);
  if (!types) return undefined;
  return copyFilter({ types, positions, opponents });
}

function readExercise(value: unknown, label: string, errors: string[]): ExerciseTemplate | undefined {
  if (!isObject(value)) {
    errors.push(`${label} isn't an exercise.`);
    return undefined;
  }
  if (value.kind === "range") {
    const filter = readFilter(value.filter, label, errors);
    const times = readInteger(value.timesInARow, `${label} "correct in a row"`, 1, MAX_TIMES_IN_A_ROW, errors);
    return filter && times ? { kind: "range", filter, timesInARow: times } : undefined;
  }
  if (value.kind === "hands") {
    const filter = readFilter(value.filter, label, errors);
    const count = readInteger(value.count, `${label} hand count`, 1, MAX_HANDS, errors);
    return filter && count ? { kind: "hands", filter, count } : undefined;
  }
  errors.push(`${label} must be a "range" (rebuild charts) or "hands" (hand quiz) exercise.`);
  return undefined;
}

function readLesson(value: unknown, index: number, errors: string[]): Lesson | undefined {
  const label = `Lesson ${index + 1}`;
  if (!isObject(value)) {
    errors.push(`${label} isn't a lesson.`);
    return undefined;
  }
  const title = readText(value.title, `${label} title`, errors, true);
  const id = value.id === undefined ? `lesson-${index + 1}` : readText(value.id, `${label} id`, errors, true);
  const stack =
    value.stack === undefined || value.stack === null
      ? undefined
      : readInteger(value.stack, `${label} stack`, 1, MAX_STACK, errors);

  let body: string[] = [];
  if (value.body !== undefined) {
    const paragraphs =
      typeof value.body === "string" ? [value.body] : readTextList(value.body, `${label} text`, errors);
    body = (paragraphs ?? []).map((paragraph) => paragraph.trim()).filter(Boolean);
  }

  const stats =
    value.stats === undefined || value.stats === null
      ? undefined
      : readFilter(value.stats, `${label} chart table`, errors);

  const exercises: ExerciseTemplate[] = [];
  if (!Array.isArray(value.exercises) || value.exercises.length === 0) {
    errors.push(`${label} needs at least one exercise.`);
  } else {
    value.exercises.forEach((item, exerciseIndex) => {
      const exercise = readExercise(item, `${label}, exercise ${exerciseIndex + 1}`, errors);
      if (exercise) exercises.push(exercise);
    });
  }

  if (!title || !id) return undefined;
  return {
    id,
    title,
    ...(stack !== undefined ? { stack } : {}),
    body,
    ...(stats ? { stats } : {}),
    exercises,
  };
}

// Reads a course from parsed JSON. Errors are written for people, not programs.
export function parseCourse(json: unknown): { course: Course } | { errors: string[] } {
  if (!isObject(json)) return { errors: ["The file doesn't contain a course."] };
  if ("range" in json && !("lessons" in json)) {
    return { errors: ["This is a range file, not a course file."] };
  }
  if (json.format !== undefined && json.format !== COURSE_FORMAT) {
    return { errors: ["This isn't a course file."] };
  }

  const errors: string[] = [];
  if (
    json.version !== undefined &&
    (typeof json.version !== "number" || json.version > COURSE_VERSION)
  ) {
    errors.push(`This course file is from a newer version (only version ${COURSE_VERSION} is supported).`);
  }
  const name = readText(json.name, "Course name", errors, true);
  const description = readText(json.description, "Course description", errors, false) ?? "";
  const game = readText(json.game, "Course game", errors, true);
  const stack = readInteger(json.stack, "Course stack", 1, MAX_STACK, errors);
  const id = json.id === undefined ? newCourseId(name ?? "course") : readText(json.id, "Course id", errors, true);
  if (id && BUILT_IN_IDS.includes(id)) errors.push(`The id "${id}" belongs to a built-in course.`);

  const lessons: Lesson[] = [];
  if (!Array.isArray(json.lessons) || json.lessons.length === 0) {
    errors.push("A course needs at least one lesson.");
  } else {
    json.lessons.forEach((item, index) => {
      const lesson = readLesson(item, index, errors);
      if (lesson) lessons.push(lesson);
    });
  }
  const lessonIds = lessons.map((lesson) => lesson.id);
  const duplicate = lessonIds.find((lessonId, index) => lessonIds.indexOf(lessonId) !== index);
  if (duplicate) errors.push(`Two lessons have the same id ("${duplicate}").`);

  if (errors.length > 0 || !id || !name || !game || !stack) return { errors };
  return { course: { id, name, description, game, stack, lessons } };
}

// ---------------------------------------------------------------------------
// Drafts for the course builder

export function blankExercise(
  kind: "range" | "hands",
  filter: RangeFilter = { types: ["RFI"], positions: ["UTG"] }
): ExerciseDraft {
  return { kind, filter: copyFilter(filter), timesInARow: 1, count: 30 };
}

export function blankLesson(number: number): LessonDraft {
  return {
    id: newLessonId(),
    title: `Lesson ${number}`,
    stack: null,
    bodyText: "",
    statsEnabled: false,
    stats: { types: ["RFI"] },
    exercises: [blankExercise("range"), blankExercise("hands")],
  };
}

export function blankDraft(): CourseDraft {
  return {
    id: newCourseId("course"),
    name: "",
    description: "",
    game: "cash",
    stack: 100,
    lessons: [blankLesson(1)],
  };
}

export function draftFromCourse(course: Course): CourseDraft {
  return {
    id: course.id,
    name: course.name,
    description: course.description,
    game: course.game,
    stack: course.stack,
    lessons: course.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      stack: lesson.stack ?? null,
      bodyText: lesson.body.join("\n\n"),
      statsEnabled: Boolean(lesson.stats),
      stats: copyFilter(lesson.stats ?? { types: ["RFI"] }),
      exercises: lesson.exercises.map((exercise) => ({
        kind: exercise.kind,
        filter: copyFilter(exercise.filter),
        timesInARow: exercise.kind === "range" ? exercise.timesInARow : 1,
        count: exercise.kind === "hands" ? exercise.count : 30,
      })),
    })),
  };
}

export function courseFromDraft(draft: CourseDraft): Course {
  return {
    id: draft.id,
    name: draft.name.trim(),
    description: draft.description.trim(),
    game: draft.game,
    stack: draft.stack,
    lessons: draft.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title.trim(),
      ...(lesson.stack !== null && lesson.stack !== undefined ? { stack: lesson.stack } : {}),
      body: lesson.bodyText
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean),
      ...(lesson.statsEnabled ? { stats: copyFilter(lesson.stats) } : {}),
      exercises: lesson.exercises.map(
        (exercise): ExerciseTemplate =>
          exercise.kind === "range"
            ? { kind: "range", filter: copyFilter(exercise.filter), timesInARow: exercise.timesInARow }
            : { kind: "hands", filter: copyFilter(exercise.filter), count: exercise.count }
      ),
    })),
  };
}

// A light shape check for a draft restored from storage.
export function isCourseDraft(value: unknown): value is CourseDraft {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.game === "string" &&
    typeof value.stack === "number" &&
    Array.isArray(value.lessons) &&
    value.lessons.length > 0 &&
    value.lessons.every(
      (lesson) =>
        isObject(lesson) &&
        typeof lesson.bodyText === "string" &&
        isObject(lesson.stats) &&
        Array.isArray(lesson.exercises)
    )
  );
}

// Problems that stop a draft from being saved, and warnings that don't.
export function checkCourse(draft: CourseDraft, manifest: RangeInfo[]) {
  const result = parseCourse(toCourseFile(courseFromDraft(draft)));
  const errors = "errors" in result ? [...result.errors] : [];
  const warnings: string[] = [];
  if (manifest.length === 0) return { errors, warnings };

  draft.lessons.forEach((lesson, index) => {
    const label = `Lesson ${index + 1}`;
    const stack = lesson.stack ?? draft.stack;
    if (!manifest.some((range) => range.game === draft.game && range.stack === stack)) {
      errors.push(`${label}: there are no ${draft.game} charts at ${stack}bb.`);
      return;
    }
    lesson.exercises.forEach((exercise, exerciseIndex) => {
      if (exercise.filter.types.length === 0) return;
      if (resolveUrls(copyFilter(exercise.filter), manifest, draft.game, stack).length === 0) {
        errors.push(`${label}, exercise ${exerciseIndex + 1}: no charts match.`);
      }
    });
    if (
      lesson.statsEnabled &&
      lesson.stats.types.length > 0 &&
      resolveUrls(copyFilter(lesson.stats), manifest, draft.game, stack).length === 0
    ) {
      warnings.push(`${label}: no charts match the chart table, so it won't be shown.`);
    }
  });
  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// The user's own courses, saved in this browser

export function loadCustomCourses(): Course[] {
  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOM_COURSES_KEY) ?? "[]");
    if (!Array.isArray(saved)) return [];
    return saved.flatMap((item) => {
      const result = parseCourse(item);
      return "course" in result ? [result.course] : [];
    });
  } catch {
    return [];
  }
}

function saveCustomCourses(list: Course[]) {
  try {
    localStorage.setItem(CUSTOM_COURSES_KEY, JSON.stringify(list.map(toCourseFile)));
  } catch {
    // Storage is full or blocked; the list lasts until the page is closed.
  }
}

// Adds a course, or replaces the one with the same id. Returns the new list.
export function upsertCustomCourse(course: Course): Course[] {
  const list = loadCustomCourses();
  const index = list.findIndex((item) => item.id === course.id);
  if (index === -1) list.push(course);
  else list[index] = course;
  saveCustomCourses(list);
  return list;
}

export function removeCustomCourse(id: string): Course[] {
  const list = loadCustomCourses().filter((item) => item.id !== id);
  saveCustomCourses(list);
  return list;
}

// ---------------------------------------------------------------------------

export function downloadJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link); // required for Firefox
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
