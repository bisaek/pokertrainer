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
    boxFromTwoHands,
  } from "../../utils/range.svelte";

  let {
    pokerRange = new PokerRange(),
    selectedAction = Action.Fold,
    compareTo = undefined,
    marked = undefined,
  }: {
    pokerRange: PokerRange;
    selectedAction: Action;
    compareTo?: PokerRange;
    // A hand to point out, such as the one being asked about.
    marked?: Hand;
  } = $props();

  let startHand: Hand | undefined = $state(undefined);
  let shiftDown: boolean = $state(false);
  let ctrlDown: boolean = $state(false);
  let line: number[][] = $state([]);
  let box: number[][] = $state([]);

  const COMPARE_CLASS: Record<string, string> = {
    [Action.Raise]: "compare-raise",
    [Action.Call]: "compare-call",
    [Action.Fold]: "compare-fold",
    [Action.AllIn]: "compare-allin",
  };

  function toggleHand(event: MouseEvent, index: number) {
    if (shiftDown || ctrlDown) {
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
      box = boxFromTwoHands(startHand, index);
    } else {
      if (event.buttons !== 1) return; // Only proceed if left mouse button is pressed
      pokerRange.range[index] = selectedAction;
    }
  }

  function createLine() {
    if (startHand !== undefined) {
      pokerRange.changeActionAtVectors(line, selectedAction);
      startHand = undefined;
    }
  }

  function createBox() {
    if (startHand !== undefined) {
      pokerRange.changeActionAtVectors(box, selectedAction);
      startHand = undefined;
    }
  }

  // The chart's action for a cell, shown as an outline when checking an answer.
  function getCompareClass(index: number): string {
    if (!compareTo) return "";
    const action = compareTo.range[index];
    return action ? COMPARE_CLASS[action] : "";
  }

  // Cells covered by a Shift line or Ctrl box while it's being dragged.
  function getHoverClass(index: number): string {
    if (startHand === undefined) return "";
    const [row, col] = handToVector(index);
    const inLine = shiftDown && line.some((vec) => vec[0] === row && vec[1] === col);
    const inBox = ctrlDown && box.some((vec) => vec[0] === row && vec[1] === col);
    return inLine || inBox ? `${getButtonClass(selectedAction)} range-cell-preview` : "";
  }

  function keyDown(Event: KeyboardEvent) {
    if (Event.key === "Shift") {
      shiftDown = true;
    }
    if (Event.key === "Control") {
      ctrlDown = true;
    }
  }

  function keyUp(Event: KeyboardEvent) {
    if (Event.key === "Shift") {
      shiftDown = false;
      startHand = undefined;
    }
    if (Event.key === "Control") {
      ctrlDown = false;
      startHand = undefined;
    }
  }

  function mouseUp(Event: MouseEvent) {
    if (shiftDown) {
      createLine();
    } else if (ctrlDown) {
      createBox();
    }
  }
</script>

<svelte:window onkeydown={keyDown} onkeyup={keyUp} onmouseup={mouseUp} />
{#each Array(PokerRangeLength) as _, index}
  <!-- svelte-ignore a11y_mouse_events_have_key_events -->
  <button
    class="range-cell {getHoverClass(index) ||
      `${getButtonClass(pokerRange.range[index])} ${getCompareClass(index)}`} {marked ===
    index
      ? 'range-cell-marked'
      : ''}"
    onmouseover={(e) => toggleHand(e, index)}
    onmousedown={(e) => toggleHand(e, index)}
    onmouseleave={(e) => toggleHand(e, index)}
    title={HandStrings[index]}
  >
    {HandStrings[index]}
  </button>
{/each}
