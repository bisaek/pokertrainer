<script lang="ts">
  import Card from "@components/practice/card.svelte";
  import type { Situation } from "@utils/table";

  let {
    situation,
    cards,
    heroAction = null,
    result = null,
  }: {
    situation: Situation;
    // The hero's two cards as [rank, suit] pairs, e.g. ["A", "S"].
    cards: [string, string][];
    // What the hero just did, shown in front of their seat.
    heroAction?: string | null;
    result?: "correct" | "wrong" | null;
  } = $props();
</script>

<div
  class="relative aspect-4/3 w-full sm:aspect-16/9"
  data-table
  style="container-type: inline-size"
>
  <!-- The felt -->
  <div
    class="absolute inset-[9%] rounded-[50%] border-2 border-accent-600/25 bg-radial-[circle_at_50%_40%] from-ink-800 to-ink-950 shadow-[inset_0_0_60px_rgba(0,0,0,0.6)]"
  ></div>

  <!-- Pot and what has happened so far -->
  <div
    class="absolute top-[32%] left-1/2 flex w-[52%] -translate-x-1/2 flex-col items-center gap-1 text-center"
  >
    <span
      class="rounded-full bg-ink-950/70 px-3 py-1 text-[3.2cqw] font-semibold tabular-nums text-accent-300 sm:text-[2.4cqw]"
      data-pot
    >
      Pot {situation.pot}bb
    </span>
    <p class="text-[3cqw] leading-snug text-ink-300 sm:text-[2.2cqw]" data-headline>
      {situation.headline}
    </p>
  </div>

  {#each situation.seats as seat (seat.position)}
    <!-- Before the hero acts their seat still shows the raise that got them here. -->
    {@const label = seat.hero ? (heroAction ?? seat.action) : seat.action}
    <div
      class="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[0.4cqw]"
      style="left: {seat.x}%; top: {seat.y}%"
      data-seat={seat.position}
      data-seat-hero={seat.hero ? "" : undefined}
    >
      <div
        class="flex min-w-[13cqw] flex-col items-center rounded-lg border px-[1.6cqw] py-[1cqw] text-center
          {seat.hero
          ? 'border-accent-500 bg-ink-850'
          : seat.folded
            ? 'border-ink-800 bg-ink-900/60 opacity-45'
            : 'border-ink-700 bg-ink-900'}"
      >
        <span
          class="text-[3.4cqw] font-semibold sm:text-[2.4cqw]
            {seat.hero ? 'text-accent-300' : 'text-ink-100'}"
        >
          {seat.position}
        </span>
        <span class="text-[2.8cqw] text-ink-400 sm:text-[1.9cqw]">
          {seat.hero ? "You" : `${situation.stack}bb`}
        </span>
      </div>
      {#if seat.position === "BTN"}
        <span
          class="absolute -top-[1cqw] -right-[2.5cqw] grid h-[4.5cqw] w-[4.5cqw] place-items-center rounded-full bg-ink-100 text-[2.6cqw] font-bold text-ink-950"
          title="Dealer button"
        >
          D
        </span>
      {/if}
      {#if label}
        <span
          class="rounded-full px-[1.6cqw] py-[0.5cqw] text-[2.6cqw] whitespace-nowrap sm:text-[1.8cqw]
            {seat.hero && heroAction
            ? result === 'correct'
              ? 'bg-emerald-500/15 text-emerald-300'
              : result === 'wrong'
                ? 'bg-red-500/15 text-red-300'
                : 'bg-accent-500/15 text-accent-300'
            : seat.folded
              ? 'text-ink-600'
              : 'bg-ink-800 text-ink-300'}"
          data-seat-action={seat.position}
        >
          {label}
        </span>
      {/if}
      {#if seat.chips > 0 && !seat.folded}
        <span
          class="rounded-full bg-ink-950/80 px-[1.4cqw] py-[0.4cqw] text-[2.4cqw] tabular-nums text-accent-400 sm:text-[1.7cqw]"
          data-seat-chips={seat.position}
        >
          {seat.chips}bb
        </span>
      {/if}
    </div>
  {/each}

  <!-- The hero's cards, dealt in front of their seat -->
  <div
    class="absolute top-[64%] left-1/2 flex origin-center -translate-x-1/2 -translate-y-1/2 scale-[0.55] gap-2 sm:scale-75"
    data-hero-cards
  >
    {#each cards as [rank, suit]}
      <Card {rank} {suit} />
    {/each}
  </div>
</div>
