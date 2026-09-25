// Plays a drill's groups (see GroupRules): which exercise comes next, and
// what a mistake puts back in the queue.
import type { DrillGroup, DrillNode } from "./drills";
import { shuffle } from "./practice";

type Step = { kind: "exercise"; index: number } | GroupRun;

// A group being played: its parts still to come, with the order and picks
// already made, and whether a mistake was made in it so far.
type GroupRun = { kind: "group"; group: DrillGroup; queue: Step[]; missed: boolean };

function start(group: DrillGroup): GroupRun {
  const queue: Step[] = [];
  for (let round = 0; round < Math.max(1, group.repeat ?? 1); round++) {
    let items = group.shuffle ? shuffle([...group.items]) : group.items;
    if (group.pick !== undefined && group.pick < items.length) {
      // Picked at random, but still in order unless the group shuffles.
      const picked = new Set(shuffle([...items]).slice(0, Math.max(1, group.pick)));
      items = items.filter((item) => picked.has(item));
    }
    queue.push(...items.map((item) => (item.kind === "group" ? start(item) : item)));
  }
  return { kind: "group", group, queue, missed: false };
}

function size(step: Step): number {
  return step.kind === "exercise" ? 1 : step.queue.reduce((sum, inner) => sum + size(inner), 0);
}

export class DrillRun {
  // The groups the current exercise is in, the drill itself first.
  private stack: GroupRun[];

  constructor(items: DrillNode[]) {
    this.stack = [start({ kind: "group", items })];
  }

  // The next exercise's index, or null when the drill is done.
  next(): number | null {
    while (this.stack.length > 0) {
      const run = this.stack[this.stack.length - 1];
      const step = run.queue.shift();
      if (step?.kind === "exercise") return step.index;
      if (step) {
        this.stack.push(step);
        continue;
      }
      // The group is done. A mistake in it counts for the groups around it
      // too, and brings it back at the end of the one it's in.
      this.stack.pop();
      const parent = this.stack[this.stack.length - 1];
      if (parent && run.missed) {
        parent.missed = true;
        if (run.group.redoMistakes) parent.queue.push(start(run.group));
      }
    }
    return null;
  }

  mistake() {
    const run = this.stack[this.stack.length - 1];
    if (run) run.missed = true;
  }

  // How many exercises are still to come after the current one, as things
  // stand; a mistake can add more.
  remaining(): number {
    return this.stack.reduce((sum, run) => sum + size(run), 0);
  }

  // The names of the groups the current exercise is in, outermost first.
  names(): string[] {
    return this.stack.flatMap((run) => (run.group.name ? [run.group.name] : []));
  }
}
