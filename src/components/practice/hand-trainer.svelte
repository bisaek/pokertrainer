<script lang="ts">
  import { PokerRange } from "@utils/range.svelte";
  import RangesSelecter from "@components/range/ranges-selecter.svelte";
  import { settings } from "@utils/settings.svelte";
  import HandQuiz from "./hand-quiz.svelte";
  import TrainerOptions from "./trainer-options.svelte";

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
  <!-- The options sit in the header, so they stay put when the picker is hidden. -->
  <header class="flex items-start gap-4">
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <span class="eyebrow">Train</span>
      <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 class="page-title">Hand trainer</h1>
        <p class="page-lead">
          Pick the charts to practice, then choose the action for each hand. The
          options decide what happens to a wrong answer and what you see.
        </p>
      </div>
    </div>
    <TrainerOptions trainer="hand" />
  </header>

  <!-- The picker and the import button can be hidden in the options; they
       are kept mounted so the selection isn't lost while out of sight. -->
  <section
    class="card flex flex-wrap items-start gap-x-6 gap-y-3 py-3 sm:py-3 {settings.picker
      ? ''
      : 'hidden'}"
  >
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

  <!-- The quiz restarts on its own when the ranges or the round length change. -->
  <HandQuiz
    {ranges}
    count={settings.handCount || undefined}
    mistakes={settings.handMistakes}
    repeatMistakes={settings.handRepeat}
  />
</div>
