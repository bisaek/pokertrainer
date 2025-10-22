<script lang="ts">
  import {
    PokerRange,
    Action,
    Hand,
    HandStrings,
    PokerRangeLength,
    getButtonClass,
    lineFromTwoHands,
    handToVector,
  } from "../../utils/range.svelte";

  let {
    pokerRange = new PokerRange(),
    selectedAction = Action.Fold,
    compareTo = undefined,
  }: {
    pokerRange: PokerRange;
    selectedAction: Action;
    compareTo?: PokerRange;
  } = $props();

  let startHand: Hand | undefined = $state(undefined);
  let shiftDown: boolean = $state(false);
  let line: number[][] = $state([]);

  function toggleHand(event: MouseEvent, index: number) {
    // console.log(event);
    if (shiftDown) {
      if (event.buttons !== 1) {
        return;
      }

      if (startHand === undefined) {
        startHand = index;
      }

      line = lineFromTwoHands(
        Math.min(startHand, index),
        Math.max(startHand, index)
      );
    } else {
      if (event.buttons !== 1) return; // Only proceed if left mouse button is pressed
      pokerRange.range[index] = selectedAction;
      //pokerRange = new PokerRange(pokerRange.name, [...pokerRange.range]); // Trigger reactivity
    }
  }

  function createLine(event: MouseEvent) {
    if (startHand !== undefined) {
      pokerRange.changeActionAtVectors(line, selectedAction);
      startHand = undefined;
    }
  }

  function getCompareClass(index: number): string {
    if (!compareTo) return "";

    switch (compareTo.range[index]) {
      case Action.Raise:
        return "border-4 border-red-500";
      case Action.Call:
        return "border-4 border-green-500";
      case Action.Fold:
        return "border-4 border-gray-300";
      case Action.AllIn:
        return "border-4 border-blue-500";
      default:
        return "";
    }
  }

  function getHoverClass(index: number): string {
    console.log(line);
    if (startHand === undefined) return "";

    if (
      line.some(
        (vec) =>
          vec[0] === handToVector(index)[0] && vec[1] === handToVector(index)[1]
      )
    ) {
      switch (pokerRange.range[index]) {
        case Action.Fold:
          return "bg-gray-400";
        case Action.Call:
          return "bg-green-600 text-white";
        case Action.Raise:
          return "bg-red-600 text-white";
        case Action.AllIn:
          return "bg-blue-600 text-white";
        default:
          return "bg-gray-200";
      }
    }
    return "";
  }

  function keyDown(Event: KeyboardEvent) {
    console.log(Event.key);
    if (Event.key === "Shift") {
      shiftDown = true;
    }
  }

  function keyUp(Event: KeyboardEvent) {
    if (Event.key === "Shift") {
      shiftDown = false;
      startHand = undefined;
    }
  }
</script>

<svelte:window onkeydown={keyDown} onkeyup={keyUp} />
{#each Array(PokerRangeLength) as _, index}
  <!-- svelte-ignore a11y_mouse_events_have_key_events -->
  <button
    class={`rounded ${getButtonClass(pokerRange.range[index])} ${getCompareClass(index)} ${getHoverClass(index)}`}
    onmouseover={(e) => toggleHand(e, index)}
    onmousedown={(e) => toggleHand(e, index)}
    onmouseup={createLine}
    title={HandStrings[index]}
  >
    {HandStrings[index]}
  </button>
{/each}
