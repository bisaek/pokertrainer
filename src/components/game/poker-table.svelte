<script lang="ts">
  import Card from "@components/practice/card.svelte";
  import type { Situation } from "@utils/table";

  let {
    situation,
    cards = [],
    heroAction = null,
    result = null,
    shape = "wide",
  }: {
    situation: Situation;
    // The hero's two cards as [rank, suit] pairs, e.g. ["A", "S"]; none when the
    // whole chart is being trained rather than one hand.
    cards?: [string, string][];
    // What the hero just did, shown in front of their seat.
    heroAction?: string | null;
    result?: "correct" | "wrong" | null;
    // A long table for a wide space, a rounder one for a tall column.
    shape?: "wide" | "compact";
  } = $props();

  // Bets sit between their seat and the pot. The hero's would land under their
  // cards, so they go beside them instead.
  const towardsPot = (value: number) => 50 + (value - 50) * 0.55;
  const betAt = (seat: { x: number; y: number; hero: boolean }) =>
    seat.hero ? { x: 68, y: 78 } : { x: towardsPot(seat.x), y: towardsPot(seat.y) };
</script>

<!-- A schematic of the spot, not a picture of a table: an outline, seats as tags,
     and every number in tabular figures. container-type: size so it scales with
     the smaller side of whatever box it is given. -->
<div
  class="relative w-full shrink-0 {shape === 'wide'
    ? 'aspect-3/2 sm:aspect-2/1'
    : 'aspect-3/2'}"
  data-table
  style="container-type: size"
>
  <div
    class="absolute inset-[5%] rounded-[50%] border border-ink-700 bg-ink-900/50"
    aria-hidden="true"
  ></div>

  <!-- Pot and what has happened so far -->
  <div
    class="absolute top-[38%] left-1/2 flex w-[42%] -translate-x-1/2 flex-col items-center gap-[0.6cqmin] text-center"
  >
    <span
      class="text-[max(0.625rem,2.4cqmin)] font-semibold tabular-nums text-accent-400 sm:text-[max(0.6875rem,2cqmin)]"
      data-pot
    >
      POT {situation.pot}bb
    </span>
    <p
      class="text-[max(0.5625rem,2.1cqmin)] leading-tight text-ink-400 sm:text-[max(0.625rem,1.8cqmin)]"
      data-headline
    >
      {situation.headline}
    </p>
  </div>

  <!-- What each seat has put in -->
  {#each situation.seats as seat (seat.position + "-chips")}
    {#if seat.chips > 0 && !seat.folded}
      <span
        class="absolute -translate-x-1/2 -translate-y-1/2 text-[max(0.5625rem,2cqmin)] font-semibold tabular-nums text-accent-400 sm:text-[max(0.625rem,1.7cqmin)]"
        style="left: {betAt(seat).x}%; top: {betAt(seat).y}%"
        data-seat-chips={seat.position}
      >
        {seat.chips}bb
      </span>
    {/if}
  {/each}

  {#each situation.seats as seat (seat.position)}
    <!-- Before the hero acts their seat still shows the raise that got them here. -->
    {@const label = seat.hero ? (heroAction ?? seat.action) : seat.action}
    <div
      class="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[0.5cqmin]"
      style="left: {seat.x}%; top: {seat.y}%"
      data-seat={seat.position}
      data-seat-hero={seat.hero ? "" : undefined}
    >
      <div
        class="flex items-center gap-[1.2cqmin] rounded border px-[1.4cqmin] py-[0.6cqmin] leading-none whitespace-nowrap
          {seat.hero
          ? 'border-accent-500 bg-accent-500/10'
          : seat.folded
            ? 'border-ink-800 bg-ink-950/60'
            : 'border-ink-700 bg-ink-900'}"
      >
        <span
          class="text-[max(0.5625rem,2.2cqmin)] font-semibold sm:text-[max(0.6875rem,1.9cqmin)]
            {seat.hero ? 'text-accent-300' : seat.folded ? 'text-ink-600' : 'text-ink-100'}"
        >
          {seat.position}
        </span>
        <span
          class="text-[max(0.5rem,1.9cqmin)] tabular-nums sm:text-[max(0.625rem,1.6cqmin)]
            {seat.folded ? 'text-ink-700' : 'text-ink-500'}"
        >
          {situation.stack}
        </span>
        {#if seat.position === "BTN"}
          <!-- The button doesn't fold when its player does. -->
          <span
            class="rounded-sm bg-ink-100 px-[0.8cqmin] text-[max(0.5rem,1.8cqmin)] font-bold text-ink-950 sm:text-[max(0.5625rem,1.5cqmin)]"
            title="Dealer button">D</span
          >
        {/if}
      </div>
      {#if label}
        <span
          class="text-[max(0.5rem,1.9cqmin)] tabular-nums whitespace-nowrap sm:text-[max(0.625rem,1.6cqmin)]
            {seat.hero && heroAction
            ? result === 'correct'
              ? 'text-emerald-400'
              : result === 'wrong'
                ? 'text-red-400'
                : 'text-accent-400'
            : seat.folded
              ? 'text-ink-700'
              : 'text-ink-400'}"
          data-seat-action={seat.position}
        >
          {label}
        </span>
      {/if}
    </div>
  {/each}

  <!-- The hero's cards -->
  <div
    class="absolute top-[64%] left-1/2 flex -translate-x-1/2 -translate-y-1/2 gap-[1cqmin] [&_img]:h-[20cqmin] [&_img]:w-auto [&_img]:rounded-[0.6cqmin] [&_img]:shadow-[0_0.6cqmin_1.6cqmin_rgba(0,0,0,0.6)]"
    data-hero-cards
  >
    {#each cards as [rank, suit]}
      <Card {rank} {suit} />
    {/each}
  </div>
</div>
