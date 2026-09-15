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

<div class="page">
  <header class="flex flex-col gap-2">
    <span class="eyebrow">Train</span>
    <h1 class="page-title">Hand trainer</h1>
    <p class="page-lead">
      Pick the charts to practice, then choose the action for each hand. Wrong
      answers come back until you get them right.
    </p>
  </header>

  <HandQuiz {ranges}>
    <!-- The quiz restarts on its own when the ranges change. -->
    <section class="card flex flex-col gap-4">
      <h2 class="section-title">Charts</h2>
      <RangesSelecter
        changeRanges={(picked: PokerRange[]) => (selectedRanges = picked)}
        start={() => {}}
      />
      <label class="flex flex-col gap-2 border-t border-ink-700 pt-4">
        <span class="label">Or import a range file</span>
        <input type="file" class="file-input" onchange={importRange} />
      </label>
    </section>
  </HandQuiz>
</div>
