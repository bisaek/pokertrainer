<script lang="ts">
  import { onMount } from "svelte";
  import {
    fetchManifest,
    positionOrder,
    rangeInfoFromName,
    type RangeInfo,
  } from "@utils/manifest";
  import type { PokerRange } from "@utils/range.svelte";
  import { buildSituation } from "@utils/table";
  import PokerTable from "./poker-table.svelte";

  let {
    range,
    cards = [],
  }: {
    // The chart being trained.
    range: PokerRange | undefined;
    // The hand being asked, when there is one.
    cards?: [string, string][];
  } = $props();

  // Shared with every trainer, so the table stays open where you left it.
  const STORAGE_KEY = "pokertrainer.show-table.v1";

  let show = $state(false);
  let manifest: RangeInfo[] = $state.raw([]);

  // A chart loaded from our own files knows exactly which spot it is; otherwise
  // its name has to say, and a seat we can't place gets no table at all.
  const info = $derived.by(() => {
    if (!range) return null;
    const found = range.source ?? rangeInfoFromName(range.name);
    if (!found) return null;
    const seated =
      positionOrder.includes(found.position) &&
      (found.opponent === null || positionOrder.includes(found.opponent));
    return seated ? found : null;
  });
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

  onMount(() => {
    try {
      show = localStorage.getItem(STORAGE_KEY) === "1";
    } catch (error) {
      console.error(error);
    }
    if (show) load();
  });

  async function load() {
    if (manifest.length > 0) return;
    try {
      manifest = await fetchManifest();
    } catch (error) {
      console.error(error);
    }
  }

  function toggle() {
    show = !show;
    try {
      localStorage.setItem(STORAGE_KEY, show ? "1" : "0");
    } catch (error) {
      console.error(error);
    }
    if (show) load();
  }
</script>

{#if info}
  <div class="flex flex-col gap-3" data-spot-table>
    <button class="btn btn-ghost self-start" onclick={toggle} data-spot-toggle>
      {show ? "Hide the table" : "Show the table"}
    </button>
    {#if show && situation}
      <PokerTable {situation} {cards} />
    {/if}
  </div>
{/if}
