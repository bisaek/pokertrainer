<script lang="ts">
  import { PokerRange } from "../../utils/range.svelte";

  import RangeLayout from "../range/range-layout.svelte";

  let { pokerRange = new PokerRange() }: { pokerRange: PokerRange } = $props();

  function downloadRange() {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(pokerRange.toJSON()));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", pokerRange.name + ".json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  function importRange(e: Event) {
    const file = (e?.target as HTMLInputElement)?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        pokerRange = PokerRange.fromJSON(json);
      } catch (error) {
        console.error("Error parsing JSON:", error);
      }
    };
    reader.readAsText(file);
  }
</script>

<div class="page">
  <header class="flex flex-col gap-2">
    <span class="eyebrow">Tools</span>
    <h1 class="page-title">Range builder</h1>
    <p class="page-lead">
      Paint a range, give it a name, and download it as a file you can import in
      the trainers.
    </p>
  </header>

  <RangeLayout {pokerRange}>
    <div class="flex flex-col gap-4 border-t border-ink-700 pt-4">
      <label class="flex flex-col gap-2">
        <span class="label">Name</span>
        <input type="text" class="input" bind:value={pokerRange.name} />
      </label>
      <button class="btn btn-primary w-full" onclick={() => downloadRange()}
        >Download range</button
      >
      <label class="flex flex-col gap-2 border-t border-ink-700 pt-4">
        <span class="label">Import a range file</span>
        <input type="file" class="file-input" onchange={importRange} />
      </label>
    </div>
  </RangeLayout>
</div>
