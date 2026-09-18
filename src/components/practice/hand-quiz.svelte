<script lang="ts">
  import { untrack } from "svelte";
  import {
    Action,
    getButtonClass,
    HandStrings,
    PokerRange,
  } from "@utils/range.svelte";
  import { pickQuestions, shuffle, type Question } from "@utils/practice";
  import Range from "@components/range/range.svelte";
  import PokerTable from "@components/table/poker-table.svelte";
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
  // Height of the area beside the quiz card; the chart of a mistake is a
  // square of that size, and the table gets the width that is left.
  let feedbackHeight = $state(0);

  const current = $derived(questions[0]);

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
     .page-fill). The table and the chart of a mistake sit side by side so the
     table keeps its place when a mistake appears: the chart's column is as
     wide as the area is tall (less the caption), and the table gets the rest. -->
<div
  class="grid min-h-0 flex-1 items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]"
>
  <section
    class="card flex max-h-full flex-col items-center gap-4 overflow-y-auto text-center"
  >
    {#if current}
      <div class="flex w-full items-center justify-between gap-3 text-sm">
        <p class="chip chip-active cursor-default" data-quiz-range>
          {current.range.name}
        </p>
        <span class="whitespace-nowrap muted">
          <span class="font-semibold text-ink-100 tabular-nums">{questions.length}</span> left
        </span>
      </div>
      <h2 class="text-5xl font-bold tracking-tight" data-quiz-hand>
        {HandStrings[current.hand]}
      </h2>
      <div class="flex justify-center gap-3">
        <Card rank={HandStrings[current.hand].charAt(0)} suit={cardSuits[0]} />
        <Card rank={HandStrings[current.hand].charAt(1)} suit={cardSuits[1]} />
      </div>

      <div class="grid w-full grid-cols-2 gap-2">
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
      {#if compareToWithMistakes}
        <p class="text-sm text-red-300">
          Not quite. Try again: the chart shows where you went wrong.
        </p>
      {/if}
    {:else}
      <p class="py-10 muted">Pick one or more charts to start.</p>
    {/if}
  </section>

  {#if current}
    <div
      class="grid min-h-0 gap-6 lg:h-full lg:grid-cols-[minmax(0,1fr)_min(var(--chart),60%)] lg:grid-rows-[minmax(0,1fr)]"
      style:--chart="{Math.max(0, feedbackHeight - 28)}px"
      bind:clientHeight={feedbackHeight}
    >
      {#if current.range.spot}
        <div
          class="mx-auto w-full max-w-[34rem] self-start rounded-2xl border border-ink-700 bg-ink-900 p-3 sm:p-4 lg:max-w-[48rem]"
        >
          <PokerTable
            spot={current.range.spot}
            heroCards={[
              HandStrings[current.hand].charAt(0) + cardSuits[0],
              HandStrings[current.hand].charAt(1) + cardSuits[1],
            ]}
          />
        </div>
      {/if}
      {#if compareToWithMistakes}
        <!-- The caption comes first: the frame takes the rest of the column's
             height, and the grid sits at the top of it. -->
        <figure
          class="mx-auto flex min-h-0 w-full max-w-[40rem] flex-col gap-2 lg:col-start-2 lg:max-w-none"
        >
          <figcaption class="text-center text-xs muted">
            The hand you missed is filled with your answer and outlined with the
            chart's.
          </figcaption>
          <div class="range-frame min-h-0 flex-1">
            <div class="range-grid">
              <Range
                selectedAction={Action.Fold}
                pokerRange={compareToWithMistakes}
                compareTo={current.range}
              />
            </div>
          </div>
        </figure>
      {/if}
    </div>
  {/if}
</div>
