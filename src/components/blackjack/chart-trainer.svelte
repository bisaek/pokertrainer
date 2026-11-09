<script lang="ts">
  import { onMount } from "svelte";
  import BlackjackHeader from "./blackjack-header.svelte";
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

  // The rules and which charts to rebuild, kept in this browser.
  const STORAGE_KEY = "pokertrainer.blackjack-chart";
  const ALL_KINDS: HandKind[] = ["hard", "soft", "pair"];
  const options = $state({
    hitSoft17: false,
    surrender: true,
    kinds: [...ALL_KINDS],
  });

  const actions = Object.values(BjAction);
  const KEYS: Record<string, BjAction> = {
    h: BjAction.Hit,
    s: BjAction.Stand,
    d: BjAction.Double,
    p: BjAction.Split,
    r: BjAction.Surrender,
  };

  // The charts still to rebuild this round. A chart rebuilt right leaves it;
  // a wrong one goes to the back to be tried again.
  let queue: HandKind[] = $state([]);
  const kind = $derived(queue[0]);
  const rows = $derived(kind ? CHARTS[kind] : []);

  // The chart being painted: a play or nothing for every row and upcard.
  let cells: (BjAction | null)[][] = $state([]);
  let brush: BjAction = $state(BjAction.Hit);
  // Set by Check: whether every cell is right.
  let checked: { right: boolean; wrong: number } | undefined = $state();
  const stats = $state({ charts: 0, right: 0 });

  // The answer under the current rules.
  const answer = $derived(
    kind ? rows.map((_, r) => UPCARDS.map((_, u) => chartAction(kind, r, u, options))) : []
  );
  const empty = $derived(cells.flat().filter((c) => c === null).length);

  onMount(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved) Object.assign(options, saved);
      if (!options.kinds.length) options.kinds = [...ALL_KINDS];
    } catch {}
    start();
  });

  $effect(() => {
    const json = JSON.stringify(options);
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch {}
  });

  // Split is only a play on the pairs chart, surrender only when offered.
  function available(action: BjAction): boolean {
    if (action === BjAction.Split) return kind === "pair";
    if (action === BjAction.Surrender) return options.surrender;
    return true;
  }

  function blank() {
    cells = rows.map(() => UPCARDS.map(() => null));
    checked = undefined;
    if (!available(brush)) brush = BjAction.Hit;
  }

  function start() {
    queue = [...options.kinds].sort(() => Math.random() - 0.5);
    blank();
  }

  function check() {
    if (!kind) return;
    let wrong = 0;
    answer.forEach((row, r) => row.forEach((a, u) => cells[r][u] !== a && wrong++));
    checked = { right: wrong === 0, wrong };
    stats.charts++;
    if (!wrong) stats.right++;
  }

  function next() {
    if (!checked) return;
    const [done, ...rest] = queue;
    queue = checked.right ? rest : [...rest, done];
    if (!queue.length) {
      start();
    } else {
      blank();
    }
  }

  function toggleKind(k: HandKind) {
    const kinds = options.kinds.includes(k)
      ? options.kinds.filter((x) => x !== k)
      : [...options.kinds, k];
    if (!kinds.length) return;
    options.kinds = kinds;
    start();
  }

  function fillEmpty() {
    if (checked) return;
    cells = cells.map((row) => row.map((c) => c ?? brush));
  }

  // Painting: drag across cells to paint them. Holding Shift or Ctrl (Cmd on
  // a Mac) paints the box between where the drag started and where it is.
  let from: { r: number; u: number } | undefined = $state();
  let to: { r: number; u: number } | undefined = $state();
  let boxMode = $state(false);

  function inBox(r: number, u: number): boolean {
    if (!boxMode || !from || !to) return false;
    return (
      r >= Math.min(from.r, to.r) &&
      r <= Math.max(from.r, to.r) &&
      u >= Math.min(from.u, to.u) &&
      u <= Math.max(from.u, to.u)
    );
  }

  function cellAt(event: PointerEvent): { r: number; u: number } | undefined {
    const el = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const cell = el?.closest<HTMLElement>("[data-cell]");
    if (!cell) return;
    const [r, u] = cell.dataset.cell!.split(",").map(Number);
    return { r, u };
  }

  function pointerDown(event: PointerEvent) {
    if (checked || event.button !== 0) return;
    const at = cellAt(event);
    if (!at) return;
    event.preventDefault();
    // Touch captures the pointer to the first cell; let it move across.
    (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
    from = to = at;
    boxMode = event.shiftKey || event.ctrlKey || event.metaKey;
    if (!boxMode) cells[at.r][at.u] = brush;
  }

  function pointerMove(event: PointerEvent) {
    if (!from) return;
    const at = cellAt(event);
    if (!at || !to || (at.r === to.r && at.u === to.u)) return;
    // A fast drag skips cells between two pointer events; paint those too.
    if (!boxMode) {
      const steps = Math.max(Math.abs(at.r - to.r), Math.abs(at.u - to.u));
      for (let i = 1; i <= steps; i++) {
        const r = Math.round(to.r + ((at.r - to.r) * i) / steps);
        const u = Math.round(to.u + ((at.u - to.u) * i) / steps);
        cells[r][u] = brush;
      }
    }
    to = at;
  }

  function pointerUp() {
    if (from && boxMode) {
      cells = cells.map((row, r) => row.map((c, u) => (inBox(r, u) ? brush : c)));
    }
    from = to = undefined;
    boxMode = false;
  }

  function keyDown(event: KeyboardEvent) {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (checked) next();
      else check();
      return;
    }
    if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      fillEmpty();
      return;
    }
    const action = KEYS[event.key.toLowerCase()] ?? actions[Number(event.key) - 1];
    if (!action || !available(action)) return;
    event.preventDefault();
    brush = action;
  }

  function cellClass(r: number, u: number): string {
    if (inBox(r, u)) return `${ACTION_CLASS[brush]} bj-paint-preview`;
    const painted = cells[r]?.[u];
    const fill = painted ? ACTION_CLASS[painted] : "bj-paint-empty";
    if (!checked || painted === answer[r][u]) return fill;
    return `${fill} bj-paint-wrong bj-should-${answer[r][u].toLowerCase()}`;
  }
</script>

<svelte:window onkeydown={keyDown} onpointerup={pointerUp} onblur={pointerUp} />

<div class="page page-fill">
  <BlackjackHeader
    current="chart"
    lead="Paint a basic strategy chart from memory, then press Check to compare it with the answer."
  />

  <section class="card flex flex-wrap items-center gap-x-6 gap-y-3 py-3 sm:py-3" data-bj-options>
    <div class="flex flex-wrap items-center gap-2">
      <span class="label">Charts</span>
      {#each ALL_KINDS as k}
        <button
          class="chip {options.kinds.includes(k) ? 'chip-active' : ''}"
          aria-pressed={options.kinds.includes(k)}
          onclick={() => toggleKind(k)}>{KIND_NAMES[k]}</button
        >
      {/each}
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <span class="label">Dealer</span>
      <button
        class="chip {options.hitSoft17 ? '' : 'chip-active'}"
        aria-pressed={!options.hitSoft17}
        onclick={() => (options.hitSoft17 = false)}>Stands on soft 17</button
      >
      <button
        class="chip {options.hitSoft17 ? 'chip-active' : ''}"
        aria-pressed={options.hitSoft17}
        onclick={() => (options.hitSoft17 = true)}>Hits soft 17</button
      >
    </div>
    <button
      class="chip {options.surrender ? 'chip-active' : ''}"
      aria-pressed={options.surrender}
      onclick={() => {
        options.surrender = !options.surrender;
        if (!available(brush)) brush = BjAction.Hit;
      }}>Surrender</button
    >
  </section>

  <div
    class="mx-auto grid min-h-0 w-full max-w-6xl flex-1 gap-6 select-none lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:grid-rows-[minmax(0,1fr)]"
  >
    <!-- The chart being rebuilt: rows of hands against the dealer's upcard. -->
    <div class="bj-paint-frame">
      <section
        class="card bj-paint flex flex-col gap-3 {checked
          ? checked.right
            ? 'bj-paint-right'
            : 'bj-paint-missed'
          : ''}"
        style:--rows={rows.length + 1}
        data-bj-paint
      >
        <h2 class="section-title" data-bj-paint-kind={kind}>{kind ? KIND_NAMES[kind] : ""}</h2>
        <div
          class="bj-paint-grid grid gap-[2px] text-center text-xs font-semibold tabular-nums"
          role="grid"
          tabindex="-1"
          aria-label="{kind ? KIND_NAMES[kind] : ''} chart"
          onpointerdown={pointerDown}
          onpointermove={pointerMove}
        >
          <span></span>
          {#each UPCARDS as up}
            <span class="py-1 text-ink-400">{up === "T" ? "10" : up}</span>
          {/each}
          {#each rows as row, r}
            <span class="flex items-center justify-end pr-1.5 text-ink-400">{row.label}</span>
            {#each UPCARDS as up, u}
              {@const painted = cells[r]?.[u]}
              <span
                class="bj-cell {cellClass(r, u)}"
                data-cell="{r},{u}"
                title="{row.label} vs {up === 'T' ? '10' : up}{checked && painted !== answer[r][u]
                  ? `: ${answer[r][u]}`
                  : ''}"
              >
                {painted ? ACTION_LETTER[painted] : ""}
              </span>
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
              class="action-option {ACTION_CLASS[action]} {brush === action
                ? 'action-option-selected'
                : ''} disabled:cursor-not-allowed disabled:opacity-35"
              disabled={!available(action)}
              aria-pressed={brush === action}
              onclick={() => (brush = action)}
            >
              {action}
              <span class="kbd" aria-hidden="true">{index + 1}</span>
            </button>
          {/each}
        </div>
        <button class="btn btn-secondary w-full" disabled={!!checked || !empty} onclick={fillEmpty}>
          Fill empty cells with {brush} <span class="kbd" aria-hidden="true">F</span>
        </button>
        <p class="text-xs muted">
          Drag across cells to paint. Hold Shift or Ctrl (Cmd on a Mac) to paint a box.
        </p>
      </div>

      <div class="flex flex-col gap-3">
        <p class="text-sm muted" data-charts-left>
          {queue.length}
          {queue.length === 1 ? "chart" : "charts"} left this round ·
          {stats.right}/{stats.charts} right
        </p>
        {#if checked}
          <p
            class="text-sm font-medium {checked.right ? 'text-emerald-300' : 'text-red-300'}"
            data-bj-paint-result
          >
            {checked.right
              ? "Correct!"
              : `${checked.wrong} ${checked.wrong === 1 ? "cell is" : "cells are"} off. The outlines show the right play.`}
          </p>
          <button class="btn btn-primary w-full" onclick={next}>
            Next <span class="kbd" aria-hidden="true">Enter</span>
          </button>
        {:else}
          <button class="btn btn-primary w-full" onclick={check}>
            Check <span class="kbd" aria-hidden="true">Enter</span>
          </button>
          {#if empty}
            <p class="text-xs muted">{empty} {empty === 1 ? "cell" : "cells"} still empty.</p>
          {/if}
        {/if}
      </div>
    </aside>
  </div>

  <p class="shrink-0 text-xs muted">
    Basic strategy for 4 to 8 decks, doubling on any two cards and after a split, dealer peeks for blackjack.
    Keys 1 to 5 or H, S, D, P, R pick the play to paint with.
  </p>
</div>

<style>
  .bj-paint-grid {
    grid-template-columns: 2.6rem repeat(10, minmax(0, 1fr));
    touch-action: none;
    cursor: crosshair;
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
  :global(.bj-paint-empty) {
    background: var(--color-ink-800);
  }
  .bj-paint-grid :global(.bj-cell:hover) {
    filter: brightness(1.15);
  }
  :global(.bj-paint-preview) {
    box-shadow: inset 0 0 0 2px rgb(255 255 255 / 0.75);
  }
  /* A wrong cell: outlined in the color of the right play. */
  :global(.bj-paint-wrong) {
    box-shadow:
      inset 0 0 0 3px var(--should),
      inset 0 0 0 4px var(--color-ink-950);
  }
  :global(.bj-should-hit) {
    --should: var(--color-action-raise);
  }
  :global(.bj-should-stand) {
    --should: var(--color-action-fold);
  }
  :global(.bj-should-double) {
    --should: var(--color-action-call);
  }
  :global(.bj-should-split) {
    --should: #8a6ac4;
  }
  :global(.bj-should-surrender) {
    --should: var(--color-ink-300);
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
