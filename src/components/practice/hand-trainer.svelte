<script lang="ts">
  import { PokerRange } from "@utils/range.svelte";
  import RangesSelecter from "@components/range/ranges-selecter.svelte";
  import HandQuiz from "./hand-quiz.svelte";

  let importedRange: PokerRange | undefined = $state();
  let selectedRanges: PokerRange[] = $state([]);

  const ranges = $derived(
    importedRange ? [importedRange, ...selectedRanges] : selectedRanges
  );

  function importRange(e: Event) {
    const file = (e?.target as HTMLInputElement)?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        importedRange = PokerRange.fromJSON(json);
      } catch (error) {
        console.error("Error parsing JSON:", error);
      }
    };
    reader.readAsText(file);
  }
</script>

<div class="page page-fill">
  <header class="flex flex-col gap-1">
    <span class="eyebrow">Train</span>
    <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h1 class="page-title">Hand trainer</h1>
      <p class="page-lead">
        Pick the charts to practice, then choose the action for each hand. Wrong
        answers come back until you get them right.
      </p>
    </div>
  </header>

  <section class="card flex flex-wrap items-start gap-x-6 gap-y-3 py-3 sm:py-3">
    <div class="min-w-0 flex-1 basis-[28rem]">
      <RangesSelecter
        changeRanges={(picked: PokerRange[]) => (selectedRanges = picked)}
        start={() => {}}
      />
    </div>
    <label class="btn btn-secondary ml-auto self-end">
      Import a range file
      <input type="file" class="sr-only" onchange={importRange} />
    </label>
  </section>

  <!-- The quiz restarts on its own when the ranges change. -->
  <HandQuiz {ranges} />
</div>
