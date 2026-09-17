<script lang="ts">
  // A link to study the chart being trained in PeakGTO, the PokerCoaching tool behind
  // the charts. PeakGTO can't open a specific spot from a link, so this opens its
  // trainer and names the spot to pick there.
  const PEAKGTO_TRAINER_URL = "https://peak.pokercoaching.com/train";

  let { chartName }: { chartName: string } = $props();
</script>

<a
  href={PEAKGTO_TRAINER_URL}
  target="_blank"
  rel="noopener noreferrer"
  class="flex w-full flex-col gap-0.5 rounded-lg border border-ink-700 px-3 py-2 text-left transition-colors hover:border-accent-600 hover:bg-ink-850"
  data-study-link
>
  <span class="text-sm font-medium text-accent-300">
    Study this range on PeakGTO <span aria-hidden="true">↗</span>
  </span>
  <span class="text-xs muted">Pick {chartName} in PeakGTO's trainer.</span>
</a>
