<script lang="ts">
  const {
    rank,
    suit,
    class: className = "w-20 sm:w-24",
  }: { rank: String; suit: String; class?: string } = $props();
</script>

<img
  class="rounded-lg shadow-lg shadow-black/40 select-none {className}"
  src="/poker-cards/{rank}{suit}.svg"
  alt=""
  draggable="false"
/>
