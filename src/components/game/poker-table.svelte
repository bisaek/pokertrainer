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
  const towardsPot = (value: number) => 50 + (value - 50) * 0.6;
  const chipAt = (seat: { x: number; y: number; hero: boolean }) =>
    seat.hero ? { x: 66, y: 80 } : { x: towardsPot(seat.x), y: towardsPot(seat.y) };
</script>

<!-- container-type: size so everything on the felt scales with the smaller side. -->
<div
  class="relative aspect-4/3 w-full shrink-0 {shape === 'wide'
    ? 'sm:aspect-16/9'
    : 'sm:aspect-4/3'}"
  data-table
  style="container-type: size"
>
  <!-- The rail: a lit edge, a wooden body, and the table's shadow under it -->
  <div
    class="absolute inset-[2%] rounded-[50%] bg-linear-to-b from-[#7c6443] via-[#4a3b27] to-[#241d14] p-[3cqmin] shadow-[inset_0_0.5cqmin_0_rgba(255,232,190,0.22),0_3cqmin_6cqmin_-2cqmin_rgba(0,0,0,0.95)]"
  >
    <!-- The felt -->
    <div
      class="h-full w-full rounded-[50%] bg-radial-[circle_at_50%_34%] from-[#1e5040] to-[#0c2219] shadow-[inset_0_0_9cqmin_rgba(0,0,0,0.8)] ring-1 ring-black/50"
    >
      <!-- the line bets are pushed over, and the house logo inside it -->
      <div
        class="absolute inset-[24%] rounded-[50%] border border-white/8"
        aria-hidden="true"
      ></div>
      <span
        class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[24cqmin] leading-none text-white/5 select-none"
        aria-hidden="true">♠</span
      >
    </div>
  </div>

  <!-- The pot, and what has happened so far -->
  <div
    class="absolute top-[32%] left-1/2 flex w-[46%] -translate-x-1/2 flex-col items-center gap-[1.2cqmin] text-center"
  >
    <span
      class="flex items-center gap-[1.2cqmin] rounded-full bg-black/45 px-[2.4cqmin] py-[0.9cqmin] text-[max(0.625rem,2.6cqmin)] font-semibold tabular-nums text-accent-300 ring-1 ring-accent-500/25 backdrop-blur-sm sm:text-[max(0.75rem,2.3cqmin)]"
      data-pot
    >
      Pot {situation.pot}bb
    </span>
    <p
      class="text-[max(0.625rem,2.5cqmin)] leading-snug text-ink-300/90 sm:text-[max(0.75rem,2.1cqmin)]"
      data-headline
    >
      {situation.headline}
    </p>
  </div>

  <!-- Chips pushed out in front of each seat -->
  {#each situation.seats as seat (seat.position + "-chips")}
    {#if seat.chips > 0 && !seat.folded}
      <span
        class="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-[1cqmin]"
        style="left: {chipAt(seat).x}%; top: {chipAt(seat).y}%"
        data-seat-chips={seat.position}
      >
        <span class="relative inline-block h-[2.4cqmin] w-[2.4cqmin]" aria-hidden="true">
          <span
            class="absolute inset-0 rounded-full bg-linear-to-b from-accent-300 to-accent-600 ring-[0.3cqmin] ring-white/60"
          ></span>
          <span
            class="absolute inset-0 -top-[0.9cqmin] rounded-full bg-linear-to-b from-accent-300 to-accent-600 ring-[0.3cqmin] ring-white/60"
          ></span>
        </span>
        <span
          class="text-[max(0.5625rem,2.1cqmin)] font-semibold tabular-nums text-accent-300 drop-shadow-[0_0.2cqmin_0.4cqmin_rgba(0,0,0,0.9)] sm:text-[max(0.6875rem,1.8cqmin)]"
        >
          {seat.chips}bb
        </span>
      </span>
    {/if}
  {/each}

  {#each situation.seats as seat (seat.position)}
    <!-- Before the hero acts their seat still shows the raise that got them here. -->
    {@const label = seat.hero ? (heroAction ?? seat.action) : seat.action}
    <div
      class="absolute flex w-[19cqmin] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[0.8cqmin]"
      style="left: {seat.x}%; top: {seat.y}%"
      data-seat={seat.position}
      data-seat-hero={seat.hero ? "" : undefined}
    >
      <div
        class="w-full rounded-[1.6cqmin] border px-[1.2cqmin] py-[1cqmin] text-center backdrop-blur-sm
          {seat.hero
          ? 'border-accent-500/70 bg-ink-900/95 shadow-[0_0_3cqmin_rgba(226,168,51,0.35)]'
          : seat.folded
            ? 'border-white/5 bg-ink-950/60 opacity-45'
            : 'border-white/10 bg-ink-900/90'}"
      >
        <span
          class="block text-[max(0.5625rem,2.4cqmin)] leading-tight font-semibold sm:text-[max(0.75rem,2cqmin)]
            {seat.hero ? 'text-accent-300' : 'text-ink-100'}"
        >
          {seat.position}
        </span>
        <span
          class="block text-[max(0.5rem,2cqmin)] leading-tight tabular-nums text-ink-400 sm:text-[max(0.625rem,1.7cqmin)]"
        >
          {seat.hero ? "You" : `${situation.stack}bb`}
        </span>
      </div>
      {#if label}
        <span
          class="rounded-full px-[1.6cqmin] py-[0.5cqmin] text-[max(0.5625rem,2.1cqmin)] whitespace-nowrap sm:text-[max(0.6875rem,1.8cqmin)]
            {seat.hero && heroAction
            ? result === 'correct'
              ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30'
              : result === 'wrong'
                ? 'bg-red-500/20 text-red-200 ring-1 ring-red-400/30'
                : 'bg-accent-500/20 text-accent-300 ring-1 ring-accent-400/30'
            : seat.folded
              ? 'bg-black/25 text-ink-600'
              : 'bg-black/45 text-ink-300 ring-1 ring-white/5'}"
          data-seat-action={seat.position}
        >
          {label}
        </span>
      {/if}
      <!-- Outside the seat's card: the button doesn't fold when its player does. -->
      {#if seat.position === "BTN"}
        <span
          class="absolute -top-[1.4cqmin] -right-[1.6cqmin] grid h-[4.6cqmin] w-[4.6cqmin] place-items-center rounded-full bg-linear-to-b from-white to-ink-300 text-[max(0.5rem,2.2cqmin)] font-bold text-ink-950 shadow-[0_0.4cqmin_1cqmin_rgba(0,0,0,0.7)] sm:text-[max(0.625rem,1.8cqmin)]"
          title="Dealer button"
        >
          D
        </span>
      {/if}
    </div>
  {/each}

  <!-- The hero's cards, dealt in front of their seat -->
  <div
    class="absolute top-[62%] left-1/2 flex -translate-x-1/2 -translate-y-1/2 gap-[1.2cqmin] [&_img]:h-[24cqmin] [&_img]:w-auto [&_img]:rounded-[1cqmin] [&_img]:shadow-[0_1cqmin_2.5cqmin_rgba(0,0,0,0.7)] [&_img]:ring-1 [&_img]:ring-black/30"
    data-hero-cards
  >
    {#each cards as [rank, suit], index}
      <span class="block {index === 0 ? '-rotate-3' : 'rotate-3'}">
        <Card {rank} {suit} />
      </span>
    {/each}
  </div>
</div>
