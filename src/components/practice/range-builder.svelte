<script lang="ts">
  import {
    PokerRange,
    Action,
    Hand,
    HandStrings,
    PokerRangeLength,
  } from "../../utils/range.svelte";

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
</script>

<RangeLayout {pokerRange}>
  <div class="flex flex-col">
    <div class="m-1">
      <label for="">Name: </label>
      <input
        type="text"
        class="border border-gray-300 rounded px-2 py-1"
        bind:value={pokerRange.name}
      />
    </div>
    <button
      class="bg-gray-300 hover:bg-gray-400 px-3 py-1 m-1 rounded"
      onclick={() => downloadRange()}>download</button
    >
  </div>
</RangeLayout>
