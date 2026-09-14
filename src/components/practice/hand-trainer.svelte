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

<HandQuiz {ranges}>
  <!-- The quiz restarts on its own when the ranges change. -->
  <RangesSelecter
    changeRanges={(picked: PokerRange[]) => (selectedRanges = picked)}
    start={() => {}}
  />
  <label for="">Import range to practice: </label>
  <input
    type="file"
    class="border border-gray-300 rounded px-2 py-1"
    onchange={importRange}
  />
</HandQuiz>
