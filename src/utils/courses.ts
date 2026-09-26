// The shape of a course, and how a lesson becomes a drill. The courses
// themselves are files in public/courses (see custom-courses.ts).
import {
  resolveDrill,
  resolveUrls,
  type Drill,
  type DrillItem,
  type RangeFilter,
} from "./drills";
import type { RangeInfo } from "./manifest";

export type Lesson = {
  // Stable id; saved progress refers to it.
  id: string;
  title: string;
  // Defaults to the course's stack.
  stack?: number;
  // Paragraphs of explanation. Numbers belong in the chart table, not here.
  body: string[];
  // Charts summarized in a table under the text.
  stats?: RangeFilter;
  exercises: DrillItem[];
};

export type Course = {
  id: string;
  name: string;
  description: string;
  game: string;
  stack: number;
  lessons: Lesson[];
  // Made by the player on /courses/new, so it can be edited and deleted.
  custom?: boolean;
};

export function lessonStack(course: Course, lesson: Lesson) {
  return lesson.stack ?? course.stack;
}

export function resolveLesson(
  course: Course,
  lesson: Lesson,
  manifest: RangeInfo[]
): Drill | null {
  return resolveDrill(
    { name: lesson.title, description: "", exercises: lesson.exercises },
    manifest,
    course.game,
    lessonStack(course, lesson)
  );
}

export function lessonStatsUrls(
  course: Course,
  lesson: Lesson,
  manifest: RangeInfo[]
): string[] {
  if (!lesson.stats) return [];
  return resolveUrls(lesson.stats, manifest, course.game, lessonStack(course, lesson));
}

