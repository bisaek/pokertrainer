<script lang="ts">
  import { untrack } from "svelte";
  import {
    Action,
    getButtonClass,
    HandStrings,
    PokerRange,
    PokerRangeLength,
  } from "@utils/range.svelte";
  import { pickQuestions, shuffle, type Question } from "@utils/practice";
  import Range from "@components/range/range.svelte";
  import PokerTable from "@components/table/poker-table.svelte";
  import DisplayOptions from "@components/table/display-options.svelte";
  import { display } from "@utils/display.svelte";
  import Card from "./card.svelte";

  let {
    ranges,
    count = undefined,
    fixedQuestions = undefined,
    onfinish = undefined,
  }: {
    ranges: PokerRange[];
    // How many hands to ask; all in-range hands when omitted.
    count?: number;
    // Ask exactly these hands, in random order, instead of picking from ranges.
    fixedQuestions?: Question[];
    // Called when every hand is answered; without it the quiz starts over.
    onfinish?: () => void;
  } = $props();

  // Can hold 169 questions per range, so keep it raw and reassign on change.
  let questions: Question[] = $state.raw([]);
  let compareToWithMistakes: PokerRange | undefined = $state();
  let cardSuits: string[] = $state(["C", "D"]);
  // Height of the row on a wide screen; the chart is a square of that size.
  let feedbackHeight = $state(0);

  const current = $derived(questions[0]);

  // Drawn greyed out while there is no mistake to review, so the chart keeps
  // its place on the page instead of appearing and disappearing.
  const blankRange = new PokerRange("", Array(PokerRangeLength).fill(null));

  $effect(() => {
    const quizRanges = ranges;
    const quizCount = count;
    const quizQuestions = fixedQuestions;
    untrack(() => restart(quizRanges, quizCount, quizQuestions));
  });

  function restart(
    quizRanges: PokerRange[],
    quizCount?: number,
    fixed = fixedQuestions
  ) {
    questions = fixed ? shuffle([...fixed]) : pickQuestions(quizRanges, quizCount);
    compareToWithMistakes = undefined;
    randomCardSuits();
  }

  function check(action: Action) {
    const question = questions[0];
    if (!question) return;

    if (question.range.range[question.hand] === action) {
      compareToWithMistakes = undefined;
      questions = questions.slice(1);
      randomCardSuits();
    } else {
      if (questions[questions.length - 1] !== question) {
        questions = [...questions, question];
      }
      compareToWithMistakes = new PokerRange("range", [
        ...question.range.range,
      ]);
      compareToWithMistakes.range[question.hand] = action;
    }
    if (questions.length === 0) {
      if (onfinish) {
        onfinish();
      } else {
        alert("You have finished the range!");
        restart(ranges, count);
      }
    }
  }

  // Keys 1-4 answer with the action buttons, in order.
  function keyDown(event: KeyboardEvent) {
    if (!questions[0] || event.repeat) return;
    const target = event.target as HTMLElement | null;
    if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
    const action = Object.values(Action)[Number(event.key) - 1];
    if (!action) return;
    event.preventDefault();
    check(action);
  }

  function randomCardSuits() {
    if (!questions[0]) return;
    const suits = ["C", "D", "H", "S"];
    cardSuits[0] = suits[Math.floor(Math.random() * suits.length)];

    if (HandStrings[questions[0].hand].slice(-1) === "s") {
      cardSuits[1] = cardSuits[0];
    } else {
      do {
        cardSuits[1] = suits[Math.floor(Math.random() * suits.length)];
      } while (cardSuits[1] === cardSuits[0]);
    }
  }
</script>

<svelte:window onkeydown={keyDown} />

<!-- On a wide screen the row takes the height that is left on the page (see
     .page-fill). The board with the action bar under it takes the width it
     needs to fit that height (.table-frame); the chart gets a column as wide
     as the row is tall, and the pair is centred together (.trainer-row). -->
<div
  class="trainer-row grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_min(var(--chart),60%)] lg:grid-rows-[minmax(0,1fr)]"
  style:--chart="{feedbackHeight}px"
  bind:clientHeight={feedbackHeight}
>
  {#if current}
    <div class="table-frame">
      <div class="flex max-w-[34rem] flex-col gap-4 lg:max-w-none">
        {#if current.range.spot && display.table}
          <div class="rounded-2xl border border-ink-700 bg-ink-900 p-3 sm:p-4">
            <PokerTable
              spot={current.range.spot}
              heroCards={[
                HandStrings[current.hand].charAt(0) + cardSuits[0],
                HandStrings[current.hand].charAt(1) + cardSuits[1],
              ]}
            />
          </div>
        {/if}

        <!-- The action bar. The board shows the hole cards on a wide screen;
             on a narrow one the table is too small for that, so they are
             drawn here too. -->
        <section class="card flex flex-col gap-3">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p class="chip chip-active cursor-default" data-quiz-range>
              {current.range.name}
            </p>
            <div class="flex gap-2 lg:hidden">
              <Card rank={HandStrings[current.hand].charAt(0)} suit={cardSuits[0]} />
              <Card rank={HandStrings[current.hand].charAt(1)} suit={cardSuits[1]} />
            </div>
            <h2 class="text-2xl font-bold tracking-tight" data-quiz-hand>
              {HandStrings[current.hand]}
            </h2>
            <span class="text-sm whitespace-nowrap muted">
              <span class="font-semibold text-ink-100 tabular-nums">{questions.length}</span> left
            </span>
            {#if compareToWithMistakes}
              <p class="ml-auto text-sm text-red-300">Not quite. Try again.</p>
            {/if}
          </div>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {#each Object.values(Action) as action, index}
              <button
                class="btn btn-lg justify-between font-semibold hover:brightness-110 {getButtonClass(
                  action
                )}"
                onclick={() => check(action)}
              >
                {action}
                <span class="kbd" aria-hidden="true">{index + 1}</span>
              </button>
            {/each}
          </div>
          {#if current.range.spot}
            <DisplayOptions />
          {/if}
        </section>
      </div>
    </div>

    <!-- On a narrow screen the column is a row of its own, so the greyed-out
         chart is left out rather than pushing the board off the page. -->
    <div
      class="range-frame mx-auto min-h-0 w-full max-w-[40rem] lg:col-start-2 lg:max-w-none {compareToWithMistakes
        ? ''
        : 'max-lg:hidden'}"
    >
      {#if compareToWithMistakes}
        <div class="range-grid">
          <Range
            selectedAction={Action.Fold}
            pokerRange={compareToWithMistakes}
            compareTo={current.range}
          />
        </div>
      {:else}
        <div class="range-grid range-grid-idle" aria-hidden="true">
          <Range selectedAction={Action.Fold} pokerRange={blankRange} />
        </div>
      {/if}
    </div>
  {:else}
    <p class="card self-start py-10 text-center muted">Pick one or more charts to start.</p>
  {/if}
</div>
