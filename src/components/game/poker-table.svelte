<script lang="ts">
  import type { Situation } from "@utils/table";

  let {
    situation,
    heroAction = null,
    result = null,
  }: {
    situation: Situation;
    // What the hero just did, shown under their seat.
    heroAction?: string | null;
    result?: "correct" | "wrong" | null;
  } = $props();
</script>

<!-- The spot as a strip, read left to right in the order the seats act. An oval
     spends most of its area on empty felt; this spends none. -->
<div class="flex flex-col gap-1.5" data-table>
  <!-- Eight seats across is unreadable on a phone: there it wraps to two rows. -->
  <ol
    class="grid grid-cols-4 gap-1 sm:[grid-template-columns:repeat(var(--seats),minmax(0,1fr))]"
    style="--seats: {situation.seats.length}"
  >
    {#each situation.seats as seat (seat.position)}
      {@const label = seat.hero ? (heroAction ?? seat.action) : seat.action}
      <li
        class="flex flex-col gap-0.5 rounded border px-2 py-1.5 text-center
          {seat.hero
          ? 'border-accent-500 bg-accent-500/10'
          : seat.folded
            ? 'border-ink-850 bg-ink-950/60'
            : 'border-ink-700 bg-ink-900'}"
        data-seat={seat.position}
        data-seat-hero={seat.hero ? "" : undefined}
      >
        <span class="flex items-center justify-center gap-1 leading-none">
          <span
            class="text-xs font-semibold {seat.hero
              ? 'text-accent-300'
              : seat.folded
                ? 'text-ink-600'
                : 'text-ink-100'}"
          >
            {seat.position}
          </span>
          {#if seat.position === "BTN"}
            <!-- The button doesn't fold when its player does. -->
            <span
              class="rounded-sm bg-ink-100 px-1 text-[0.6rem] leading-[1.1] font-bold text-ink-950"
              title="Dealer button">D</span
            >
          {/if}
        </span>
        <span
          class="text-[0.65rem] leading-none tabular-nums {seat.folded
            ? 'text-ink-700'
            : 'text-ink-500'}"
        >
          {seat.hero ? "you" : `${situation.stack}bb`}
        </span>
        <span
          class="truncate text-[0.7rem] leading-tight tabular-nums
            {seat.hero && heroAction
            ? result === 'correct'
              ? 'text-emerald-400'
              : result === 'wrong'
                ? 'text-red-400'
                : 'text-accent-400'
            : seat.folded
              ? 'text-ink-700'
              : seat.chips > 0
                ? 'text-accent-400'
                : 'text-ink-400'}"
          data-seat-action={seat.position}
        >
          {label ?? "–"}
        </span>
        {#if seat.chips > 0 && !seat.folded && !label}
          <span
            class="text-[0.7rem] leading-tight tabular-nums text-accent-400"
            data-seat-chips={seat.position}
          >
            {seat.chips}bb
          </span>
        {:else if seat.chips > 0 && !seat.folded}
          <span class="hidden" data-seat-chips={seat.position}>{seat.chips}bb</span>
        {/if}
      </li>
    {/each}
  </ol>
  <p class="flex flex-wrap items-baseline gap-x-2 text-xs">
    <span class="font-semibold tabular-nums text-accent-400" data-pot>
      POT {situation.pot}bb
    </span>
    <span class="text-ink-400" data-headline>{situation.headline}</span>
  </p>
</div>
