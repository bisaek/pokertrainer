<script lang="ts">
  import { onMount } from "svelte";
  import { fetchManifest, type RangeInfo } from "@utils/manifest";
  import type { PokerRange } from "@utils/range.svelte";
  import { buildSituation, spotFor } from "@utils/table";
  import { tableView } from "@utils/table-view.svelte";
  import PokerTable from "./poker-table.svelte";

  let {
    range,
    cards = [],
    shape = "wide",
  }: {
    // The chart being trained.
    range: PokerRange | undefined;
    // The hand being asked, when there is one.
    cards?: [string, string][];
    shape?: "wide" | "compact";
  } = $props();

  let manifest: RangeInfo[] = $state.raw([]);

  const info = $derived(spotFor(range));
  // Everyone at the table: the seats that have a chart at this game and stack.
  const positions = $derived(
    info
      ? [
          ...new Set(
            manifest
              .filter((seat) => seat.game === info.game && seat.stack === info.stack)
              .map((seat) => seat.position)
          ),
        ]
      : []
  );
  const situation = $derived(
    info && positions.length > 0 ? buildSituation(info, positions) : null
  );

  onMount(async () => {
    tableView.load();
    try {
      manifest = await fetchManifest();
    } catch (error) {
      console.error(error);
    }
  });
</script>

{#if tableView.shown && situation}
  <PokerTable {situation} {cards} {shape} />
{/if}
