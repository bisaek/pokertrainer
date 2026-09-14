<script lang="ts">
  import { untrack, type Snippet } from "svelte";
  import {
    Action,
    getButtonClass,
    HandStrings,
    PokerRange,
  } from "@utils/range.svelte";
  import { pickQuestions, type Question } from "@utils/practice";
  import Range from "@components/range/range.svelte";
  import Card from "./card.svelte";

  let {
    ranges,
    count = undefined,
    onfinish = undefined,
    children,
  }: {
    ranges: PokerRange[];
    // How many hands to ask; all in-range hands when omitted.
    count?: number;
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
    untrack(() => restart(quizRanges, quizCount));
  });

  function restart(quizRanges: PokerRange[], quizCount?: number) {
    questions = pickQuestions(quizRanges, quizCount);
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

<div
  class="flex flex-col md:flex-row flex-wrap items-center justify-around gap-4 p-2"
>
  <div class="flex flex-col w-full max-w-xs">
    {#if current}
      <p class="text-center">hands back: {questions.length}</p>
      <p class="text-center font-semibold">{current.range.name}</p>
      <h2 class="text-4xl text-center">{HandStrings[current.hand]}</h2>
      <div class="flex flex-row gap-4 justify-center">
        <Card rank={HandStrings[current.hand].charAt(0)} suit={cardSuits[0]} />
        <Card rank={HandStrings[current.hand].charAt(1)} suit={cardSuits[1]} />
      </div>

      <div class="flex flex-row flex-wrap justify-center gap-2 mt-2">
        {#each Object.values(Action) as action}
          <button
            class={`inline-block px-4 py-2 m-1 rounded text-base ${getButtonClass(action)}`}
            onclick={() => check(action)}
          >
            {action}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <div class="m-1">
    <div class="grid grid-cols-13 gap-1 aspect-square w-full">
      {#if compareToWithMistakes && current}
        <Range
          selectedAction={Action.Fold}
          pokerRange={compareToWithMistakes}
          compareTo={current.range}
        />
      {/if}
    </div>
    {@render children?.()}
  </div>
</div>
