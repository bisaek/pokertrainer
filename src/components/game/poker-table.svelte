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

  // Chips sit on the felt in front of their seat, between it and the pot. The
  // hero's would land under their cards, so they go beside them instead.
  const towardsPot = (value: number) => 50 + (value - 50) * 0.62;
  const chipAt = (seat: { x: number; y: number; hero: boolean }) =>
    seat.hero ? { x: 64, y: 80 } : { x: towardsPot(seat.x), y: towardsPot(seat.y) };
</script>

<!-- container-type: size so everything on the felt scales with the smaller side. -->
<div
  class="relative aspect-4/3 w-full shrink-0 {shape === 'wide'
    ? 'sm:aspect-16/9'
    : 'sm:aspect-4/3'}"
  data-table
  style="container-type: size"
>
  <!-- The rail, and the felt inside it -->
  <div
    class="absolute inset-[3%] rounded-[50%] bg-linear-to-b from-[#6b573a] via-[#4a3c28] to-[#2b231a] p-[1.4cqmin] shadow-[0_2cqmin_4cqmin_-2cqmin_rgba(0,0,0,0.9)]"
  >
    <div
      class="h-full w-full rounded-[50%] bg-radial-[circle_at_50%_36%] from-[#22322b] to-[#111a16] shadow-[inset_0_0_6cqmin_rgba(0,0,0,0.75)] ring-1 ring-black/40"
    >
      <!-- the line bets are pushed over, and the house logo inside it -->
      <div
        class="absolute inset-[22%] rounded-[50%] border border-white/4"
        aria-hidden="true"
      ></div>
      <span
        class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[26cqmin] leading-none text-white/4 select-none"
        aria-hidden="true">♠</span
      >
    </div>
  </div>

  <!-- The pot, and what has happened so far -->
  <div
    class="absolute top-[34%] left-1/2 flex w-[46%] -translate-x-1/2 flex-col items-center gap-[1cqmin] text-center"
  >
    <span
      class="flex items-center gap-[1.2cqmin] rounded-full bg-black/45 px-[2.4cqmin] py-[0.9cqmin] text-[max(0.625rem,2.6cqmin)] font-semibold tabular-nums text-accent-200 ring-1 ring-accent-500/20 backdrop-blur-sm sm:text-[max(0.75rem,2.3cqmin)]"
      data-pot
    >
      <span
        class="inline-block h-[1.8cqmin] w-[1.8cqmin] rounded-full bg-accent-400 ring-[0.4cqmin] ring-accent-400/25"
        aria-hidden="true"
      ></span>
      Pot {situation.pot}bb
    </span>
    <p
      class="text-[max(0.625rem,2.5cqmin)] leading-snug text-ink-300/90 sm:text-[max(0.75rem,2.1cqmin)]"
      data-headline
    >
      {situation.headline}
    </p>
  </div>

  <!-- Chips in front of each seat -->
  {#each situation.seats as seat (seat.position + "-chips")}
    {#if seat.chips > 0 && !seat.folded}
      <span
        class="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-[0.8cqmin] rounded-full bg-black/55 px-[1.4cqmin] py-[0.4cqmin] text-[max(0.5625rem,2cqmin)] tabular-nums text-accent-200 ring-1 ring-white/10 sm:text-[max(0.6875rem,1.8cqmin)]"
        style="left: {chipAt(seat).x}%; top: {chipAt(seat).y}%"
        data-seat-chips={seat.position}
      >
        <span
          class="inline-block h-[1.4cqmin] w-[1.4cqmin] rounded-full bg-accent-400 ring-1 ring-black/50"
          aria-hidden="true"
        ></span>
        {seat.chips}bb
      </span>
    {/if}
  {/each}

  {#each situation.seats as seat (seat.position)}
    <!-- Before the hero acts their seat still shows the raise that got them here. -->
    {@const label = seat.hero ? (heroAction ?? seat.action) : seat.action}
    <div
      class="absolute flex w-[24cqmin] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[0.8cqmin]"
      style="left: {seat.x}%; top: {seat.y}%"
      data-seat={seat.position}
      data-seat-hero={seat.hero ? "" : undefined}
    >
      <div
        class="relative flex w-full items-center gap-[1.2cqmin] rounded-full border py-[0.9cqmin] pr-[2cqmin] pl-[0.9cqmin] backdrop-blur-sm
          {seat.hero
          ? 'border-accent-500/70 bg-ink-900/95 shadow-[0_0_3cqmin_rgba(226,168,51,0.35)]'
          : seat.folded
            ? 'border-white/5 bg-ink-950/60 opacity-50'
            : 'border-white/10 bg-ink-900/90'}"
      >
        <span
          class="grid aspect-square w-[5.4cqmin] shrink-0 place-items-center rounded-full text-[max(0.5rem,2.6cqmin)] sm:text-[max(0.625rem,2.3cqmin)]
            {seat.hero ? 'bg-accent-500 text-ink-950' : 'bg-ink-800 text-ink-400'}"
          aria-hidden="true"
        >
          ♠
        </span>
        <span class="flex min-w-0 flex-col leading-tight">
          <span
            class="truncate text-[max(0.5625rem,2.4cqmin)] font-semibold sm:text-[max(0.75rem,2.1cqmin)]
              {seat.hero ? 'text-accent-200' : 'text-ink-100'}"
          >
            {seat.position}
          </span>
          <span
            class="text-[max(0.5rem,2cqmin)] tabular-nums text-ink-400 sm:text-[max(0.625rem,1.7cqmin)]"
          >
            {seat.hero ? "You" : `${situation.stack}bb`}
          </span>
        </span>
        {#if seat.position === "BTN"}
          <span
            class="absolute -top-[1.2cqmin] -right-[1.2cqmin] grid h-[4.4cqmin] w-[4.4cqmin] place-items-center rounded-full bg-ink-100 text-[max(0.5rem,2.2cqmin)] font-bold text-ink-950 shadow-[0_0.4cqmin_1cqmin_rgba(0,0,0,0.6)] sm:text-[max(0.625rem,1.8cqmin)]"
            title="Dealer button"
          >
            D
          </span>
        {/if}
      </div>
      {#if label}
        <span
          class="rounded-full px-[1.6cqmin] py-[0.5cqmin] text-[max(0.5625rem,2.2cqmin)] whitespace-nowrap sm:text-[max(0.6875rem,1.9cqmin)]
            {seat.hero && heroAction
            ? result === 'correct'
              ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30'
              : result === 'wrong'
                ? 'bg-red-500/20 text-red-200 ring-1 ring-red-400/30'
                : 'bg-accent-500/20 text-accent-200 ring-1 ring-accent-400/30'
            : seat.folded
              ? 'text-ink-600'
              : 'bg-black/45 text-ink-300 ring-1 ring-white/5'}"
          data-seat-action={seat.position}
        >
          {label}
        </span>
      {/if}
    </div>
  {/each}

  <!-- The hero's cards, dealt in front of their seat -->
  <div
    class="absolute top-[63%] left-1/2 flex -translate-x-1/2 -translate-y-1/2 gap-[1.2cqmin] [&_img]:h-[24cqmin] [&_img]:w-auto [&_img]:shadow-[0_1cqmin_2.5cqmin_rgba(0,0,0,0.65)]"
    data-hero-cards
  >
    {#each cards as [rank, suit], index}
      <span class="block {index === 0 ? '-rotate-3' : 'rotate-3'}">
        <Card {rank} {suit} />
      </span>
    {/each}
  </div>
</div>
