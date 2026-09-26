// Plays a drill's groups (see GroupRules): which exercise comes next, and
// what a mistake puts back in the queue.
import type { DrillGroup, DrillNode } from "./drills";
import { shuffle } from "./practice";

type Step = { kind: "exercise"; index: number } | GroupRun;

// A group being played, or one round of a group played more than once:
// its parts still to come, with the order and picks already made, and
// whether a mistake was made in it so far. `redoParts` brings a part with a
// mistake back at the end of this run, which for a repeated group is the end
// of the round; `redoWhole` brings the group back in the one around it.
type GroupRun = {
  kind: "group";
  group: DrillGroup;
  name?: string;
  redoParts: boolean;
  redoWhole: boolean;
  queue: Step[];
  missed: boolean;
};

function start(group: DrillGroup): GroupRun {
  const round = (): GroupRun => {
    let items = group.shuffle ? shuffle([...group.items]) : group.items;
    if (group.pick !== undefined && group.pick < items.length) {
      // Picked at random, but still in order unless the group shuffles.
      const picked = new Set(shuffle([...items]).slice(0, Math.max(1, group.pick)));
      items = items.filter((item) => picked.has(item));
    }
    return {
      kind: "group",
      group,
      redoParts: group.redoParts ?? false,
      redoWhole: false,
      queue: items.map((item) => (item.kind === "group" ? start(item) : item)),
      missed: false,
    };
  };
  const rounds = Math.max(1, group.repeat ?? 1);
  const whole = { name: group.name, redoWhole: group.redoMistakes ?? false };
  if (rounds === 1) return { ...round(), ...whole };
  // Each round is a run of its own inside the group's.
  return {
    kind: "group",
    group,
    ...whole,
    redoParts: false,
    queue: Array.from({ length: rounds }, round),
    missed: false,
  };
}

function size(step: Step): number {
  return step.kind === "exercise" ? 1 : step.queue.reduce((sum, inner) => sum + size(inner), 0);
}

export class DrillRun {
  // The groups the current exercise is in, the drill itself first.
  private stack: GroupRun[];
  // The exercise being played, and whether a mistake was made in it.
  private current: number | null = null;
  private currentMissed = false;

  constructor(items: DrillNode[]) {
    this.stack = [start({ kind: "group", items })];
  }

  // The next exercise's index, or null when the drill is done.
  next(): number | null {
    const top = this.stack[this.stack.length - 1];
    if (top && this.current !== null && this.currentMissed) {
      top.missed = true;
      if (top.redoParts) top.queue.push({ kind: "exercise", index: this.current });
    }
    this.current = null;
    this.currentMissed = false;
    while (this.stack.length > 0) {
      const run = this.stack[this.stack.length - 1];
      const step = run.queue.shift();
      if (step?.kind === "exercise") {
        this.current = step.index;
        return step.index;
      }
      if (step) {
        this.stack.push(step);
        continue;
      }
      // The group is done. A mistake in it counts for the groups around it
      // too, and brings it back at the end of the one it's in if either
      // group says so.
      this.stack.pop();
      const parent = this.stack[this.stack.length - 1];
      if (parent && run.missed) {
        parent.missed = true;
        if (run.redoWhole || parent.redoParts) parent.queue.push(start(run.group));
      }
    }
    return null;
  }

  mistake() {
    this.currentMissed = true;
  }

  // How many exercises are still to come after the current one, as things
  // stand; a mistake can add more.
  remaining(): number {
    return this.stack.reduce((sum, run) => sum + size(run), 0);
  }

  // The names of the groups the current exercise is in, outermost first.
  names(): string[] {
    return this.stack.flatMap((run) => (run.name ? [run.name] : []));
  }
}
