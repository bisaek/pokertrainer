<script lang="ts">
  import Card from "@components/practice/card.svelte";
  import type { Situation } from "@utils/table";

  let {
    situation,
    cards = [],
    heroAction = null,
    result = null,
    fill = false,
  }: {
    situation: Situation;
    // The hero's two cards as [rank, suit] pairs, e.g. ["A", "S"]; none when the
    // whole chart is being trained rather than one hand.
    cards?: [string, string][];
    // What the hero just did, shown in front of their seat.
    heroAction?: string | null;
    result?: "correct" | "wrong" | null;
    // Fill the height of its container instead of keeping a fixed shape.
    fill?: boolean;
  } = $props();
</script>

<!-- container-type: size so everything on the felt scales with the smaller side. -->
<div
  class="relative w-full aspect-4/3 sm:aspect-16/9 {fill ? 'lg:aspect-auto lg:h-full' : ''}"
  data-table
  style="container-type: size"
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
      class="rounded-full bg-ink-950/70 px-3 py-1 text-[max(0.625rem,3.2cqmin)] font-semibold tabular-nums text-accent-300 sm:text-[max(0.625rem,2.4cqmin)]"
      data-pot
    >
      Pot {situation.pot}bb
    </span>
    <p class="text-[max(0.625rem,3cqmin)] leading-snug text-ink-300 sm:text-[max(0.625rem,2.2cqmin)]" data-headline>
      {situation.headline}
    </p>
  </div>

  {#each situation.seats as seat (seat.position)}
    <!-- Before the hero acts their seat still shows the raise that got them here. -->
    {@const label = seat.hero ? (heroAction ?? seat.action) : seat.action}
    <div
      class="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[0.4cqmin]"
      style="left: {seat.x}%; top: {seat.y}%"
      data-seat={seat.position}
      data-seat-hero={seat.hero ? "" : undefined}
    >
      <div
        class="flex min-w-[13cqmin] flex-col items-center rounded-lg border px-[1.6cqmin] py-[1cqmin] text-center
          {seat.hero
          ? 'border-accent-500 bg-ink-850'
          : seat.folded
            ? 'border-ink-800 bg-ink-900/60 opacity-45'
            : 'border-ink-700 bg-ink-900'}"
      >
        <span
          class="text-[max(0.625rem,3.4cqmin)] font-semibold sm:text-[max(0.625rem,2.4cqmin)]
            {seat.hero ? 'text-accent-300' : 'text-ink-100'}"
        >
          {seat.position}
        </span>
        <span class="text-[max(0.625rem,2.8cqmin)] text-ink-400 sm:text-[max(0.625rem,1.9cqmin)]">
          {seat.hero ? "You" : `${situation.stack}bb`}
        </span>
      </div>
      {#if seat.position === "BTN"}
        <span
          class="absolute -top-[1cqmin] -right-[2.5cqmin] grid h-[4.5cqmin] w-[4.5cqmin] place-items-center rounded-full bg-ink-100 text-[max(0.625rem,2.6cqmin)] font-bold text-ink-950"
          title="Dealer button"
        >
          D
        </span>
      {/if}
      {#if label}
        <span
          class="rounded-full px-[1.6cqmin] py-[0.5cqmin] text-[max(0.625rem,2.6cqmin)] whitespace-nowrap sm:text-[max(0.625rem,1.8cqmin)]
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
          class="rounded-full bg-ink-950/80 px-[1.4cqmin] py-[0.4cqmin] text-[max(0.625rem,2.4cqmin)] tabular-nums text-accent-400 sm:text-[max(0.625rem,1.7cqmin)]"
          data-seat-chips={seat.position}
        >
          {seat.chips}bb
        </span>
      {/if}
    </div>
  {/each}

  <!-- The hero's cards, dealt in front of their seat -->
  <div
    class="absolute top-[64%] left-1/2 flex -translate-x-1/2 -translate-y-1/2 gap-[1.5cqmin] [&_img]:h-[26cqmin] [&_img]:w-auto"
    data-hero-cards
  >
    {#each cards as [rank, suit]}
      <Card {rank} {suit} />
    {/each}
  </div>
</div>
