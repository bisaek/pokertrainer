import type { APIRoute } from "astro";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// Serves every course file in public/courses/*.json as one list, so a course
// made on /courses/new and downloaded becomes a built-in course by being
// dropped in that folder, the way a chart file goes in public/ranges. The
// files are passed on as they are; the courses page checks their shape.
export const GET: APIRoute = async () => {
  const root = join(process.cwd(), "public", "courses");
  const files: unknown[] = [];
  let names: string[] = [];
  try {
    names = (await readdir(root)).filter((name) => name.endsWith(".json")).sort();
  } catch {
    // No folder yet: no built-in course files.
  }
  for (const name of names) {
    try {
      files.push(JSON.parse(await readFile(join(root, name), "utf8")));
    } catch (error) {
      console.error(`Couldn't read course file ${name}:`, error);
    }
  }
  return new Response(JSON.stringify(files), {
    headers: { "Content-Type": "application/json" },
  });
};
