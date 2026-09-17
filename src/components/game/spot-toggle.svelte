<script lang="ts">
  import { onMount } from "svelte";
  import type { PokerRange } from "@utils/range.svelte";
  import { spotFor } from "@utils/table";
  import { tableView } from "@utils/table-view.svelte";

  let {
    range,
    class: className = "",
  }: {
    // The chart being trained; there is nothing to show without a spot for it.
    range: PokerRange | undefined;
    class?: string;
  } = $props();

  onMount(() => tableView.load());
</script>

{#if spotFor(range)}
  <button
    class="btn btn-ghost {className}"
    onclick={() => tableView.toggle()}
    data-spot-toggle
  >
    {tableView.shown ? "Hide the table" : "Show the table"}
  </button>
{/if}
