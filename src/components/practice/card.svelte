<script lang="ts">
  const { rank, suit }: { rank: String; suit: String } = $props();
</script>

<img
  class="w-20 rounded-lg shadow-lg shadow-black/40 select-none sm:w-24"
  src="/poker-cards/{rank}{suit}.svg"
  alt=""
  draggable="false"
/>
