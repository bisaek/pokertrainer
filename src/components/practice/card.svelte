<script lang="ts">
  import { onMount } from "svelte";
  import { preloadCards } from "@utils/preload-cards";

  const {
    rank,
    suit,
    class: className = "w-20 sm:w-24",
  }: { rank: String; suit: String; class?: string } = $props();

  // The first card on a page loads the rest, so the next one shows at once.
  onMount(preloadCards);
</script>

<img
  class="rounded-lg shadow-lg shadow-black/40 select-none {className}"
  src="/poker-cards/{rank}{suit}.svg"
  alt=""
  draggable="false"
/>
