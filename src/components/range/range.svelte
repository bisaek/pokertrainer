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
    kinds = false,
    lockEmpty = false,
  }: {
    pokerRange: PokerRange;
    selectedAction: Action;
    compareTo?: PokerRange;
    // A hand to point out, such as the one being asked about.
    marked?: Hand;
    // Tint the cells by kind: pairs on the diagonal, suited above it and
    // offsuit below.
    kinds?: boolean;
    // Keep hands outside the range (null) empty, so a blank chart in the
    // trainers can only be painted where the answer has an action.
    lockEmpty?: boolean;
  } = $props();

  function isLocked(index: number): boolean {
    return lockEmpty && pokerRange.range[index] === null;
  }

  // The cells of a line or box that can be painted.
  function paintable(vectors: number[][]): number[][] {
    return vectors.filter(([row, col]) => !isLocked(row * 13 + col));
  }

  function getKindClass(index: number): string {
    if (!kinds) return "";
    const [row, col] = handToVector(index);
    return row === col ? "kind-pair" : col > row ? "kind-suited" : "kind-offsuit";
  }

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
      if (isLocked(index)) return;
      pokerRange.range[index] = selectedAction;
    }
  }

  function createLine() {
    if (startHand !== undefined) {
      pokerRange.changeActionAtVectors(paintable(line), selectedAction);
      startHand = undefined;
    }
  }

  function createBox() {
    if (startHand !== undefined) {
      pokerRange.changeActionAtVectors(paintable(box), selectedAction);
      startHand = undefined;
    }
  }

  // The chart's action for a cell, shown as an outline when checking an answer.
  function getCompareClass(index: number): string {
    if (!compareTo) return "";
    const action = compareTo.range[index];
    return action ? COMPARE_CLASS[action] : "";
  }

  // Cells covered by a Shift line or Ctrl/Cmd box while it's being dragged.
  function getHoverClass(index: number): string {
    if (startHand === undefined || isLocked(index)) return "";
    const [row, col] = handToVector(index);
    const inLine = shiftDown && line.some((vec) => vec[0] === row && vec[1] === col);
    const inBox = ctrlDown && box.some((vec) => vec[0] === row && vec[1] === col);
    return inLine || inBox ? `${getButtonClass(selectedAction)} range-cell-preview` : "";
  }

  function keyDown(Event: KeyboardEvent) {
    if (Event.key === "Shift") {
      shiftDown = true;
    }
    // Cmd works too, since Ctrl+click is a right click on a Mac.
    if (Event.key === "Control" || Event.key === "Meta") {
      ctrlDown = true;
    }
  }

  function keyUp(Event: KeyboardEvent) {
    if (Event.key === "Shift") {
      shiftDown = false;
      startHand = undefined;
    }
    if (Event.key === "Control" || Event.key === "Meta") {
      ctrlDown = false;
      startHand = undefined;
    }
  }

  // Keys let go while the window is in the background, like after Cmd+Tab,
  // never send a keyup.
  function blur() {
    shiftDown = false;
    ctrlDown = false;
    startHand = undefined;
  }

  // Keep the right-click menu from opening on a Ctrl+click on a Mac.
  function contextMenu(Event: MouseEvent) {
    if (Event.ctrlKey) Event.preventDefault();
  }

  function mouseUp(Event: MouseEvent) {
    if (shiftDown) {
      createLine();
    } else if (ctrlDown) {
      createBox();
    }
  }
</script>

<svelte:window onkeydown={keyDown} onkeyup={keyUp} onmouseup={mouseUp} onblur={blur} />
{#each Array(PokerRangeLength) as _, index}
  <!-- svelte-ignore a11y_mouse_events_have_key_events -->
  <button
    class="range-cell {getHoverClass(index) ||
      `${getButtonClass(pokerRange.range[index])} ${getCompareClass(index)}`} {getKindClass(
      index
    )} {marked === index ? 'range-cell-marked' : ''} {isLocked(index) ? 'range-cell-locked' : ''}"
    onmouseover={(e) => toggleHand(e, index)}
    onmousedown={(e) => toggleHand(e, index)}
    onmouseleave={(e) => toggleHand(e, index)}
    oncontextmenu={contextMenu}
    title={HandStrings[index]}
  >
    {HandStrings[index]}
  </button>
{/each}
