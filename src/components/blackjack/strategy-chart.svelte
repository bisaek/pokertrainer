<script lang="ts">
  import {
    ACTION_CLASS,
    ACTION_LETTER,
    CHARTS,
    UPCARDS,
    chartAction,
    type BjRules,
    type HandKind,
  } from "@utils/blackjack";

  // One basic strategy chart under the given rules, with an optional cell
  // marked (the row and upcard of a hand).
  let {
    kind,
    rules,
    marked = undefined,
  }: {
    kind: HandKind;
    rules: BjRules;
    marked?: { row: number; upcard: number };
  } = $props();

  const rows = $derived(CHARTS[kind]);
</script>

<div
  class="bj-chart grid gap-[2px] text-center text-xs font-semibold tabular-nums"
  style:--rows={rows.length + 1}
  data-bj-chart-kind={kind}
>
  <span></span>
  {#each UPCARDS as up}
    <span class="py-1 text-ink-400">{up === "T" ? "10" : up}</span>
  {/each}
  {#each rows as row, r}
    <span class="flex items-center justify-end pr-1.5 text-ink-400">{row.label}</span>
    {#each UPCARDS as _, u}
      {@const action = chartAction(kind, r, u, rules)}
      <span
        class="bj-cell {ACTION_CLASS[action]} {marked && r === marked.row && u === marked.upcard
          ? 'bj-cell-marked'
          : ''}"
        title={action}>{ACTION_LETTER[action]}</span
      >
    {/each}
  {/each}
</div>

<style>
  .bj-cell-marked {
    box-shadow:
      inset 0 0 0 2px var(--color-ink-950),
      inset 0 0 0 4px #fff;
    filter: brightness(1.2);
  }
</style>
