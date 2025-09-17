<script lang="ts">
  const { rank, suit }: { rank: String; suit: String } = $props();
</script>

<img class="" src="/poker-cards/{rank}{suit}.svg" alt="" />
