<script lang="ts">
  import { onMount } from "svelte";
  import BlackjackHeader from "./blackjack-header.svelte";
  import TrainerOptions from "@components/practice/trainer-options.svelte";
  import { settings } from "@utils/settings.svelte";
  import {
    ACTION_CLASS,
    ACTION_LETTER,
    BjAction,
    CHARTS,
    KIND_NAMES,
    UPCARDS,
    chartAction,
    type HandKind,
  } from "@utils/blackjack";

  // Works like the poker range trainer, with its options: pick the charts,
  // paint each one from memory starting from all Hit, and check it. The
  // rules (dealer, surrender) are blackjack's own and kept in this browser.
  const STORAGE_KEY = "pokertrainer.blackjack-chart";
  const ALL_KINDS: HandKind[] = ["hard", "soft", "pair"];
  const picked = $state({
    hitSoft17: false,
    surrender: true,
    kinds: [...ALL_KINDS],
  });

  // The play a blank chart starts with, like Fold on a poker chart.
  const BLANK = BjAction.Hit;
  const actions = Object.values(BjAction);

  // The charts still to rebuild this round. A chart leaves the queue once it
  // has been rebuilt right as many times in a row as the options ask for.
  let queue: { kind: HandKind; streak: number }[] = $state([]);
  const kind = $derived(queue[0]?.kind);
  const rows = $derived(kind ? CHARTS[kind] : []);

  let cells: BjAction[][] = $state([]);
  let selectedAction: BjAction = $state(BjAction.Hit);
  let isCorrect: boolean | undefined = $state(undefined);
  const checked = $derived(isCorrect !== undefined);

  // The answer under the chosen rules.
  const answer = $derived(
    kind ? rows.map((_, r) => UPCARDS.map((_, u) => chartAction(kind, r, u, picked))) : []
  );

  onMount(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved) Object.assign(picked, saved);
      if (!picked.kinds.length) picked.kinds = [...ALL_KINDS];
    } catch {}
    start();
  });

  $effect(() => {
    const json = JSON.stringify(picked);
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch {}
  });

  // Split is only a play on the pairs chart, surrender only when offered.
  function available(action: BjAction): boolean {
    if (action === BjAction.Split) return kind === "pair";
    if (action === BjAction.Surrender) return picked.surrender;
    return true;
  }

  function blank() {
    cells = rows.map(() => UPCARDS.map(() => BLANK));
    isCorrect = undefined;
    if (!available(selectedAction)) selectedAction = BLANK;
  }

  function start() {
    queue = [...picked.kinds]
      .sort(() => Math.random() - 0.5)
      .map((kind) => ({ kind, streak: 0 }));
    blank();
  }

  function check() {
    if (!kind) return;
    isCorrect = answer.every((row, r) => row.every((a, u) => cells[r][u] === a));
  }

  function next() {
    const [item, ...rest] = queue;
    if (!item) return;
    if (isCorrect) {
      const streak = item.streak + 1;
      queue = streak >= settings.rangeStreak ? rest : [...rest, { kind: item.kind, streak }];
    } else {
      // Wrong: with retry on it is rebuilt again right away; with repeat on
      // it comes back at the end, unless already there.
      queue =
        settings.rangeRepeat && rest.at(-1)?.kind !== item.kind
          ? [...rest, { kind: item.kind, streak: 0 }]
          : rest;
      if (settings.rangeRetry) queue = [{ kind: item.kind, streak: 0 }, ...queue];
    }
    if (queue.length === 0) start();
    else blank();
  }

  function toggleKind(k: HandKind) {
    const kinds = picked.kinds.includes(k)
      ? picked.kinds.filter((x) => x !== k)
      : [...picked.kinds, k];
    if (!kinds.length) return;
    picked.kinds = kinds;
    start();
  }

  // Painting, as on a poker chart: drag across cells to paint them, hold
  // Shift for a line or Ctrl (Cmd on a Mac) for a box from where the drag
  // started to where it is.
  type Cell = { r: number; u: number };
  let from: Cell | undefined = $state();
  let to: Cell | undefined = $state();
  let mode: "paint" | "line" | "box" = $state("paint");

  function lineCells(a: Cell, b: Cell): Cell[] {
    const steps = Math.max(Math.abs(b.r - a.r), Math.abs(b.u - a.u));
    if (!steps) return [a];
    return Array.from({ length: steps + 1 }, (_, i) => ({
      r: Math.round(a.r + ((b.r - a.r) * i) / steps),
      u: Math.round(a.u + ((b.u - a.u) * i) / steps),
    }));
  }

  // The cells a Shift line or Ctrl/Cmd box covers while it is dragged.
  const preview = $derived.by(() => {
    if (!from || !to || mode === "paint") return new Set<string>();
    if (mode === "line") return new Set(lineCells(from, to).map((c) => `${c.r},${c.u}`));
    const set = new Set<string>();
    for (let r = Math.min(from.r, to.r); r <= Math.max(from.r, to.r); r++)
      for (let u = Math.min(from.u, to.u); u <= Math.max(from.u, to.u); u++) set.add(`${r},${u}`);
    return set;
  });

  function cellAt(event: PointerEvent): Cell | undefined {
    const el = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const cell = el?.closest<HTMLElement>("[data-cell]");
    if (!cell) return;
    const [r, u] = cell.dataset.cell!.split(",").map(Number);
    return { r, u };
  }

  function pointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    const at = cellAt(event);
    if (!at) return;
    event.preventDefault();
    // Touch captures the pointer to the first cell; let it move across.
    (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
    from = to = at;
    mode = event.shiftKey ? "line" : event.ctrlKey || event.metaKey ? "box" : "paint";
    if (mode === "paint") cells[at.r][at.u] = selectedAction;
  }

  function pointerMove(event: PointerEvent) {
    if (!from || !to) return;
    const at = cellAt(event);
    if (!at || (at.r === to.r && at.u === to.u)) return;
    // A fast drag skips cells between two pointer events; paint those too.
    if (mode === "paint") for (const c of lineCells(to, at)) cells[c.r][c.u] = selectedAction;
    to = at;
  }

  function pointerUp() {
    if (from && mode !== "paint") {
      cells = cells.map((row, r) => row.map((c, u) => (preview.has(`${r},${u}`) ? selectedAction : c)));
    }
    from = to = undefined;
    mode = "paint";
  }

  // Keep the right-click menu from opening on a Ctrl+click on a Mac.
  function contextMenu(event: MouseEvent) {
    if (event.ctrlKey) event.preventDefault();
  }

  function keyDown(event: KeyboardEvent) {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
    // Space on a focused button presses that button instead.
    if (event.key === " " && target && ["BUTTON", "SUMMARY"].includes(target.tagName)) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (checked) next();
      else check();
      return;
    }
    const action = actions[Number(event.key) - 1];
    if (!action || !available(action)) return;
    selectedAction = action;
  }

  const COMPARE_CLASS: Record<BjAction, string> = {
    [BjAction.Hit]: "bj-compare-hit",
    [BjAction.Stand]: "bj-compare-stand",
    [BjAction.Double]: "bj-compare-double",
    [BjAction.Split]: "bj-compare-split",
    [BjAction.Surrender]: "bj-compare-surrender",
  };

  function cellClass(r: number, u: number): string {
    if (preview.has(`${r},${u}`)) return `${ACTION_CLASS[selectedAction]} bj-cell-preview`;
    const painted = ACTION_CLASS[cells[r]?.[u] ?? BLANK];
    // After a check every cell is outlined with the chart's play, like
    // the poker range trainer; a right cell's outline blends into its fill.
    if (checked && settings.rangeAnswer) return `${painted} ${COMPARE_CLASS[answer[r][u]]}`;
    return painted;
  }
</script>

<svelte:window onkeydown={keyDown} onpointerup={pointerUp} onblur={pointerUp} />

<div class="page page-fill">
  <BlackjackHeader
    current="chart"
    lead="Paint the chart from memory, then press Check to compare it with the answer."
  >
    {#snippet actions()}
      <TrainerOptions trainer="blackjack" />
    {/snippet}
  </BlackjackHeader>

  <!-- The chart picker, which the Options can hide like the poker one. -->
  <section
    class="card flex flex-wrap items-center gap-x-6 gap-y-3 py-3 sm:py-3 {settings.picker ? '' : 'hidden'}"
    data-bj-options
  >
    <div class="flex flex-wrap items-center gap-2">
      <span class="label">Charts</span>
      {#each ALL_KINDS as k}
        <button
          class="chip {picked.kinds.includes(k) ? 'chip-active' : ''}"
          aria-pressed={picked.kinds.includes(k)}
          onclick={() => toggleKind(k)}>{KIND_NAMES[k]}</button
        >
      {/each}
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <span class="label">Dealer</span>
      <button
        class="chip {picked.hitSoft17 ? '' : 'chip-active'}"
        aria-pressed={!picked.hitSoft17}
        onclick={() => (picked.hitSoft17 = false)}>Stands on soft 17</button
      >
      <button
        class="chip {picked.hitSoft17 ? 'chip-active' : ''}"
        aria-pressed={picked.hitSoft17}
        onclick={() => (picked.hitSoft17 = true)}>Hits soft 17</button
      >
    </div>
    <button
      class="chip {picked.surrender ? 'chip-active' : ''}"
      aria-pressed={picked.surrender}
      onclick={() => {
        picked.surrender = !picked.surrender;
        if (!available(selectedAction)) selectedAction = BLANK;
      }}>Surrender</button
    >
  </section>

  <div
    class="mx-auto grid min-h-0 w-full max-w-6xl flex-1 gap-6 select-none lg:grid-cols-[minmax(0,1fr)_minmax(22rem,30rem)] lg:grid-rows-[minmax(0,1fr)]"
  >
    <!-- The chart being rebuilt: rows of hands against the dealer's upcard. -->
    <div class="bj-paint-frame">
      <section
        class="card bj-paint flex flex-col gap-3 {isCorrect === undefined
          ? ''
          : isCorrect
            ? 'bj-paint-right'
            : 'bj-paint-missed'}"
        style:--rows={rows.length + 1}
        data-bj-paint
      >
        <h2 class="section-title" data-chart-name data-bj-paint-kind={kind}>
          {kind ? KIND_NAMES[kind] : ""}
        </h2>
        <div
          class="bj-paint-grid grid gap-[2px] text-center text-xs font-semibold tabular-nums"
          role="grid"
          tabindex="-1"
          aria-label="{kind ? KIND_NAMES[kind] : ''} chart"
          onpointerdown={pointerDown}
          onpointermove={pointerMove}
          oncontextmenu={contextMenu}
        >
          <span></span>
          {#each UPCARDS as up}
            <span class="py-1 text-ink-400">{up === "T" ? "10" : up}</span>
          {/each}
          {#each rows as row, r}
            <span class="flex items-center justify-end pr-1.5 text-ink-400">{row.label}</span>
            {#each UPCARDS as up, u}
              <button type="button" class="bj-cell {cellClass(r, u)}" data-cell="{r},{u}" title="{row.label} vs {up === 'T' ? '10' : up}">
                {ACTION_LETTER[cells[r]?.[u] ?? BLANK]}
              </button>
            {/each}
          {/each}
        </div>
      </section>
    </div>

    <aside class="card flex min-h-0 flex-col gap-5 lg:max-h-full lg:self-start lg:overflow-y-auto">
      <div class="flex flex-col gap-2">
        <span class="label">Paint with</span>
        <div class="grid grid-cols-2 gap-2">
          {#each actions as action, index}
            <button
              class="action-option {ACTION_CLASS[action]} {selectedAction === action
                ? 'action-option-selected'
                : ''} disabled:cursor-not-allowed disabled:opacity-35"
              disabled={!available(action)}
              onclick={() => (selectedAction = action)}
            >
              {action}
              {#if settings.keyHints}
                <span class="kbd" aria-hidden="true">{index + 1}</span>
              {/if}
            </button>
          {/each}
        </div>
        <p class="text-xs muted">
          Drag across cells to paint. Hold Shift for a line or Ctrl (Cmd on a Mac) for a box.
        </p>
      </div>

      <div class="flex flex-col gap-3">
        {#if kind && settings.progress}
          <p class="text-sm muted" data-charts-left>
            {queue.length}
            {queue.length === 1 ? "chart" : "charts"} left
            {#if settings.rangeStreak > 1}
              · correct in a row: {queue[0].streak}/{settings.rangeStreak}
            {/if}
          </p>
        {/if}
        {#if checked}
          <p class="text-sm font-medium {isCorrect ? 'text-emerald-300' : 'text-red-300'}" data-bj-paint-result>
            {isCorrect
              ? "Correct!"
              : settings.rangeAnswer
                ? "Not quite. The outlines show the chart."
                : "Not quite."}
          </p>
          <button class="btn btn-primary w-full" onclick={next}>
            Next <span class="kbd" aria-hidden="true">Enter</span>
          </button>
        {:else}
          <button class="btn btn-primary w-full" onclick={check}>
            Check <span class="kbd" aria-hidden="true">Enter</span>
          </button>
        {/if}
      </div>
    </aside>
  </div>

  <p class="shrink-0 text-xs muted">
    Basic strategy for 4 to 8 decks, doubling on any two cards and after a split, dealer peeks for blackjack.
  </p>
</div>

<style>
  .bj-paint-grid {
    grid-template-columns: 2.6rem repeat(10, minmax(0, 1fr));
    touch-action: none;
  }
  .bj-paint {
    outline: 3px solid transparent;
    outline-offset: 3px;
    transition: outline-color 150ms;
  }
  .bj-paint-right {
    outline-color: var(--color-emerald-400);
  }
  .bj-paint-missed {
    outline-color: var(--color-action-raise);
  }
  .bj-paint-grid :global(.bj-cell:hover) {
    filter: brightness(1.15);
  }
  :global(.bj-cell-preview) {
    box-shadow: inset 0 0 0 2px rgb(255 255 255 / 0.75);
  }
  /* The chart's play, outlined on every cell after a wrong check. */
  :global(.bj-compare-hit) {
    box-shadow: inset 0 0 0 3px var(--color-action-raise);
  }
  :global(.bj-compare-stand) {
    box-shadow: inset 0 0 0 3px var(--color-action-fold);
  }
  :global(.bj-compare-double) {
    box-shadow: inset 0 0 0 3px var(--color-action-call);
  }
  :global(.bj-compare-split) {
    box-shadow: inset 0 0 0 3px #8a6ac4;
  }
  :global(.bj-compare-surrender) {
    box-shadow: inset 0 0 0 3px var(--color-ink-600);
  }
  /* On a wide screen the chart fills the room it has without scrolling:
     square cells as big as both its width and height allow. */
  @media (min-width: 64rem) {
    .bj-paint-frame {
      container-type: size;
      min-height: 0;
    }
    .bj-paint {
      max-height: 100cqh;
    }
    .bj-paint-grid {
      --cell: min(
        (100cqw - 2.6rem - 2.5rem - 2px - 20px) / 10,
        (100cqh - 6.5rem - var(--rows) * 2px) / var(--rows)
      );
      grid-template-columns: 2.6rem repeat(10, var(--cell));
      justify-content: center;
    }
  }
</style>
