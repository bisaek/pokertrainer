<script lang="ts">
  import { seatsFor, type Spot } from "@utils/spot";
  import { settings } from "@utils/settings.svelte";

  let {
    spot,
    heroCards = undefined,
  }: {
    spot: Spot;
    // The hero's hole cards as "AS", "KD"...; card backs when omitted.
    heroCards?: [string, string];
  } = $props();

  const seats = $derived(seatsFor(spot));
  const heroIndex = $derived(seats.findIndex((seat) => seat.role === "hero"));

  // Seats sit on an ellipse with the hero at the bottom, then clockwise in the
  // order they act. Each ring is a radius in percent of the table's box.
  function place(index: number, rx: number, ry: number, turn = 0) {
    const angle = Math.PI / 2 + ((index - heroIndex) / seats.length) * 2 * Math.PI + turn;
    const x = 50 + rx * Math.cos(angle);
    const y = 50 + ry * Math.sin(angle);
    return `left: ${x.toFixed(2)}%; top: ${y.toFixed(2)}%;`;
  }

  const caption = $derived(
    [spot.game === "mtt" ? "MTT" : spot.game === "cash" ? "Cash" : null, spot.stack && `${spot.stack}bb`]
      .filter(Boolean)
      .join(" · ")
  );
</script>

<!-- Sizes are in em, and the em scales with the frame's width: container units
     resolve against an ancestor, so the frame has to wrap the table. -->
<div class="frame">
  <div
    class="table"
    role="img"
    aria-label="Table: {spot.hero} {spot.type}{spot.villain ? ` from ${spot.villain}` : ''}"
  >
    <div class="felt">
      {#if caption}
        <span class="caption">{caption}</span>
      {/if}
    </div>

    <!-- A folded seat can be left off the table; the others keep their
         places, so the table looks the same with or without it. -->
    {#each seats as seat, index}
      {#if settings.foldedSeats || seat.status !== "folded"}
        {#if seat.status !== "folded"}
          <div
            class="cards {seat.role === 'hero' ? 'cards-hero' : ''}"
            style={place(index, 30, 27)}
          >
            {#if seat.role === "hero" && heroCards}
              {#each heroCards as card}
                <img src="/poker-cards/{card}.svg" alt="" draggable="false" />
              {/each}
            {:else}
              <div class="card-back"></div>
              <div class="card-back"></div>
            {/if}
          </div>
        {/if}

        {#if seat.chips && settings.bets}
          <div
            class="bet {seat.action ? `action-${seat.action.kind}` : 'bet-blind'}"
            style={place(index, 16, 8)}
          >
            <span class="bet-chip" aria-hidden="true"></span>
            {#if seat.action}
              {seat.action.label}
            {/if}
          </div>
        {/if}

        <div
          class="seat seat-{seat.role} {seat.status === 'folded' ? 'seat-folded' : ''}"
          style={place(index, 41, 41)}
        >
          {#if seat.position === "BTN"}
            <span class="dealer" aria-hidden="true">D</span>
          {/if}
          {seat.position}
          {#if seat.role === "hero"}
            <span class="you">you</span>
          {/if}
        </div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .frame {
    container-type: inline-size;
    width: 100%;
  }
  .table {
    position: relative;
    width: 100%;
    aspect-ratio: 8 / 5;
    font-size: clamp(0.68rem, 2.6cqi, 0.85rem);
    line-height: 1;
    user-select: none;
    -webkit-user-select: none;
  }

  .felt {
    position: absolute;
    inset: 13% 11%;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: radial-gradient(ellipse at 50% 35%, #2f6b4f 0%, #22523c 50%, #193f2e 100%);
    box-shadow:
      inset 0 0 3em rgb(0 0 0 / 0.45),
      0 0 0 0.55em #4a3b2c,
      0 0 0 0.7em #2a221a,
      0 0.6em 1.6em rgb(0 0 0 / 0.5);
  }
  /* The betting line. */
  .felt::after {
    content: "";
    position: absolute;
    inset: 12% 10%;
    border-radius: 50%;
    border: 1px solid rgb(255 255 255 / 0.09);
  }
  /* In a narrow sidebar the bets would sit on top of the caption, and two
     neighbours' bets on top of each other, so both shrink. */
  @container (max-width: 24rem) {
    .caption {
      display: none;
    }
    .bet {
      font-size: 0.75em;
      padding: 0.3em 0.5em;
    }
    .bet:not(.bet-blind) .bet-chip {
      display: none;
    }
  }
  .caption {
    font-size: 0.85em;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgb(255 255 255 / 0.28);
  }

  .table > :not(.felt) {
    position: absolute;
    transform: translate(-50%, -50%);
  }

  .seat {
    display: inline-flex;
    align-items: baseline;
    gap: 0.4em;
    /* More room on top than below: the line box already leaves room for
       descenders under the capitals, so even padding would sit them high. */
    padding: 0.57em 0.8em 0.33em;
    border-radius: 999px;
    border: 1px solid var(--color-ink-600);
    background: var(--color-ink-800);
    color: var(--color-ink-100);
    font-size: 0.95em;
    font-weight: 700;
    white-space: nowrap;
    box-shadow: 0 0.2em 0.6em rgb(0 0 0 / 0.4);
  }
  .seat-folded {
    opacity: 0.55;
    box-shadow: none;
  }
  .seat-villain {
    border-color: var(--color-action-raise);
  }
  .seat-hero {
    border-color: var(--color-accent-400);
    background: color-mix(in oklab, var(--color-accent-500) 22%, var(--color-ink-800));
    color: var(--color-accent-300);
  }
  .you {
    font-size: 0.7em;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.8;
  }
  @media (prefers-reduced-motion: no-preference) {
    .seat-hero {
      animation: to-act 2s ease-out infinite;
    }
  }
  @keyframes to-act {
    from {
      box-shadow: 0 0 0 0 color-mix(in oklab, var(--color-accent-400) 55%, transparent);
    }
    to {
      box-shadow: 0 0 0 0.8em transparent;
    }
  }

  .cards {
    display: flex;
  }
  /* Cards grow with the table rather than with its text, so they stay easy
     to read on a big board; the em floor keeps them from vanishing on a phone. */
  .cards > * {
    width: max(2.1em, 6cqi);
    aspect-ratio: 5 / 7;
    border-radius: 0.25em;
    box-shadow: 0 0.15em 0.4em rgb(0 0 0 / 0.5);
  }
  .cards > :first-child {
    transform: rotate(-8deg) translateX(12%);
  }
  .cards > :last-child {
    transform: rotate(8deg) translateX(-12%);
  }
  .cards-hero > * {
    width: max(3em, 9cqi);
  }
  .cards-hero img {
    background: #fff;
  }
  .card-back {
    border: 0.18em solid #e8e2d8;
    background:
      repeating-linear-gradient(
        45deg,
        rgb(255 255 255 / 0.08) 0 0.18em,
        transparent 0.18em 0.36em
      ),
      #2f4a8a;
  }

  /* The button rides in the BTN seat's pill, left of the position. */
  .dealer {
    display: grid;
    place-items: center;
    align-self: center;
    width: 1.5em;
    height: 1.5em;
    margin-left: -0.35em;
    /* Lift it to the middle of the capitals: the line box below them holds
       room for descenders, which centring would count. */
    translate: 0 -0.16em;
    /* And the D down to the middle of the circle, for the same reason. */
    padding-top: 0.1em;
    border-radius: 50%;
    background: #f3efe9;
    color: #1c1a17;
    font-size: 0.8em;
    font-weight: 800;
    box-shadow: 0 0.1em 0.2em rgb(0 0 0 / 0.5);
  }

  .bet {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    padding: 0.3em 0.55em 0.3em 0.4em;
    border-radius: 999px;
    font-size: 0.85em;
    font-weight: 700;
    white-space: nowrap;
    box-shadow: 0 0.15em 0.4em rgb(0 0 0 / 0.4);
  }
  .bet-blind {
    padding: 0.25em;
    background: transparent;
    box-shadow: none;
  }
  /* Not .chip: that is the filter chip in global.css, whose padding would
     stretch this one. */
  .bet-chip {
    width: 1.15em;
    height: 1.15em;
    border-radius: 50%;
    border: 0.22em dashed #fff;
    background: currentColor;
    box-shadow: 0 0.1em 0 rgb(0 0 0 / 0.35);
  }
  .bet-blind .bet-chip {
    color: var(--color-ink-300);
    border-color: var(--color-ink-100);
  }
  /* The chip is the pill's color; its face lightens toward the dashed edge. */
  .action-raise .bet-chip,
  .action-allin .bet-chip,
  .action-call .bet-chip {
    background: color-mix(in oklab, currentColor 25%, var(--color-ink-950));
  }
</style>
