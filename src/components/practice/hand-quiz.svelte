<script lang="ts">
  import { untrack, type Snippet } from "svelte";
  import {
    Action,
    getButtonClass,
    HandStrings,
    PokerRange,
  } from "@utils/range.svelte";
  import { pickQuestions, shuffle, type Question } from "@utils/practice";
  import Range from "@components/range/range.svelte";
  import SpotTable from "@components/game/spot-table.svelte";
  import SpotToggle from "@components/game/spot-toggle.svelte";
  import { tableView } from "@utils/table-view.svelte";
  import Card from "./card.svelte";

  let {
    ranges,
    count = undefined,
    fixedQuestions = undefined,
    onfinish = undefined,
    children,
  }: {
    ranges: PokerRange[];
    // How many hands to ask; all in-range hands when omitted.
    count?: number;
    // Ask exactly these hands, in random order, instead of picking from ranges.
    fixedQuestions?: Question[];
    // Called when every hand is answered; without it the quiz starts over.
    onfinish?: () => void;
    children?: Snippet;
  } = $props();

  // Can hold 169 questions per range, so keep it raw and reassign on change.
  let questions: Question[] = $state.raw([]);
  let compareToWithMistakes: PokerRange | undefined = $state();
  let cardSuits: string[] = $state(["C", "D"]);

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

<div
  class="grid items-start gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-stretch"
>
  <section class="card page-panel flex flex-col items-center gap-4 text-center lg:self-start">
    {#if current}
      <div class="flex w-full items-center justify-between text-sm">
        <span class="muted">Hands left</span>
        <span class="font-semibold tabular-nums">{questions.length}</span>
      </div>
      <p class="chip chip-active cursor-default" data-quiz-range>
        {current.range.name}
      </p>
      <h2 class="text-5xl font-bold tracking-tight" data-quiz-hand>
        {HandStrings[current.hand]}
      </h2>
      {#if !tableView.shown}
        <div class="flex justify-center gap-3">
          <Card rank={HandStrings[current.hand].charAt(0)} suit={cardSuits[0]} />
          <Card rank={HandStrings[current.hand].charAt(1)} suit={cardSuits[1]} />
        </div>
      {/if}

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

  <div class="page-panel flex flex-col gap-6">
    {#if current}
      <SpotToggle range={current.range} class="-ml-3 self-start" />
      <div class="w-full max-w-[44rem]">
        <SpotTable
          range={current.range}
          cards={[
            [HandStrings[current.hand].charAt(0), cardSuits[0]],
            [HandStrings[current.hand].charAt(1), cardSuits[1]],
          ]}
        />
      </div>
    {/if}
    {#if compareToWithMistakes && current}
      <figure class="mx-auto flex w-full max-w-[40rem] flex-col gap-2">
        <div class="range-grid">
          <Range
            selectedAction={Action.Fold}
            pokerRange={compareToWithMistakes}
            compareTo={current.range}
          />
        </div>
        <figcaption class="text-center text-xs muted">
          The hand you missed is filled with your answer and outlined with the
          chart's.
        </figcaption>
      </figure>
    {/if}
    {@render children?.()}
  </div>
</div>
