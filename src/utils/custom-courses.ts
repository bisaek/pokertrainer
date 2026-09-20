import { isCustomDrill, loadCustomDrills, type CustomDrill } from "./custom-drills";
import type { Course } from "./courses";

// A lesson's practice is a drill: one saved under "Your drills", or one made
// in the lesson itself, which lives in the course and isn't listed there.
export type LessonPractice =
  | { kind: "saved"; drillId: string }
  | { kind: "own"; drill: CustomDrill };

// A lesson the player wrote: some text, then one or more drills as the
// practice, one after another.
export type CustomLesson = {
  id: string;
  title: string;
  // Paragraphs.
  body: string[];
  practice: LessonPractice[];
};

// The drill a practice item stands for, if it still exists.
export function practiceDrill(
  item: LessonPractice,
  drills: CustomDrill[]
): CustomDrill | undefined {
  return item.kind === "own" ? item.drill : drills.find((drill) => drill.id === item.drillId);
}

// A course the player put together on /courses/new. Its lessons use drills
// for its game and stack, and it is kept in this browser.
export type CustomCourse = {
  id: string;
  name: string;
  description: string;
  game: string;
  stack: number;
  lessons: CustomLesson[];
};

const STORAGE_KEY = "pokertrainer.custom-courses.v1";

export function loadCustomCourses(): CustomCourse[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(saved) ? saved.filter(isCustomCourse) : [];
  } catch {
    // Nothing saved, or storage is blocked.
    return [];
  }
}

// Adds the course, or replaces the saved one with the same id.
export function saveCustomCourse(course: CustomCourse): CustomCourse[] {
  const courses = loadCustomCourses();
  const index = courses.findIndex((item) => item.id === course.id);
  if (index === -1) courses.push(course);
  else courses[index] = course;
  store(courses);
  return courses;
}

export function removeCustomCourse(id: string): CustomCourse[] {
  const courses = loadCustomCourses().filter((item) => item.id !== id);
  store(courses);
  return courses;
}

export function newCourseId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Turns a saved course into one the courses page can show and practice: each
// lesson's exercises are its drills' exercises in a row. A drill that has
// been deleted is left out, so a lesson may end up with no practice.
export function toCourse(course: CustomCourse, drills: CustomDrill[]): Course {
  return {
    id: course.id,
    name: course.name,
    description: course.description,
    game: course.game,
    stack: course.stack,
    custom: true,
    lessons: course.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      body: lesson.body,
      exercises: lesson.practice
        .map((item) => practiceDrill(item, drills))
        .filter((drill) => drill !== undefined)
        .flatMap((drill) => drill.exercises),
    })),
  };
}

// A course file carries the saved drills its lessons use, so it works on its
// own; a lesson's own drills are already in the course.
const FILE_KIND = "pokertrainer-courses";
const FILE_VERSION = 1;

type CourseFile = {
  kind: typeof FILE_KIND;
  version: number;
  courses: CustomCourse[];
  drills: CustomDrill[];
};

export function serializeCourses(courses: CustomCourse[], drills: CustomDrill[]): string {
  const ids = new Set(
    courses.flatMap((course) =>
      course.lessons.flatMap((lesson) =>
        lesson.practice.flatMap((item) => (item.kind === "saved" ? [item.drillId] : []))
      )
    )
  );
  const file: CourseFile = {
    kind: FILE_KIND,
    version: FILE_VERSION,
    courses,
    drills: drills.filter((drill) => ids.has(drill.id)),
  };
  return JSON.stringify(file, null, 2);
}

// Reads a course file back. Throws with a message fit to show when the file
// isn't courses at all.
export function parseCourseFile(text: string): { courses: CustomCourse[]; drills: CustomDrill[] } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("This isn't a JSON file.");
  }
  if (typeof json !== "object" || json === null) {
    throw new Error("This file doesn't hold courses from this site.");
  }
  const file = json as Record<string, unknown>;
  const courses = Array.isArray(file.courses) ? file.courses : [json];
  const drills = Array.isArray(file.drills) ? file.drills : [];
  if (courses.length === 0 || !courses.every(isCustomCourse) || !drills.every(isCustomDrill)) {
    throw new Error("This file doesn't hold courses from this site.");
  }
  return { courses, drills };
}

// Puts the courses from a file in with the saved ones. A course already saved
// with the same id is replaced, so a file uploaded twice doesn't double up.
export function importCustomCourses(imported: CustomCourse[]): {
  courses: CustomCourse[];
  added: number;
  replaced: number;
} {
  const courses = loadCustomCourses();
  let added = 0;
  let replaced = 0;
  for (const course of imported) {
    const index = courses.findIndex((item) => item.id === course.id);
    if (index === -1) {
      courses.push(course);
      added++;
    } else {
      courses[index] = course;
      replaced++;
    }
  }
  store(courses);
  return { courses, added, replaced };
}

// Saves the courses, with their drills, as a file through the browser's download.
export function downloadCourses(courses: CustomCourse[], name: string) {
  const blob = new Blob([serializeCourses(courses, loadCustomDrills())], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "courses"}.json`;
  document.body.appendChild(anchor); // Firefox wants it in the page.
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function store(courses: CustomCourse[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
  } catch {
    // Storage is full or blocked; the course lasts until the page is closed.
  }
}

// Whatever is in storage came from an older version or a hand edit, so a
// course that doesn't have the right shape is left out rather than crashing.
export function isCustomCourse(value: unknown): value is CustomCourse {
  if (typeof value !== "object" || value === null) return false;
  const course = value as Record<string, unknown>;
  return (
    typeof course.id === "string" &&
    typeof course.name === "string" &&
    typeof course.description === "string" &&
    typeof course.game === "string" &&
    typeof course.stack === "number" &&
    Array.isArray(course.lessons) &&
    course.lessons.every(isLesson)
  );
}

function isLesson(value: unknown): value is CustomLesson {
  if (typeof value !== "object" || value === null) return false;
  const lesson = value as Record<string, unknown>;
  const isStrings = (list: unknown) =>
    Array.isArray(list) && list.every((item) => typeof item === "string");
  return (
    typeof lesson.id === "string" &&
    typeof lesson.title === "string" &&
    isStrings(lesson.body) &&
    Array.isArray(lesson.practice) &&
    lesson.practice.every(isPractice)
  );
}

function isPractice(value: unknown): value is LessonPractice {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    (item.kind === "saved" && typeof item.drillId === "string") ||
    (item.kind === "own" && isCustomDrill(item.drill))
  );
}
