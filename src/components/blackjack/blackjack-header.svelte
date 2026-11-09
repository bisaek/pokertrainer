<script lang="ts">
  // The title and the switch between the blackjack trainers.
  const { current, lead }: { current: "strategy" | "chart" | "counting"; lead: string } = $props();

  const tabs = [
    { key: "strategy", name: "Basic strategy", href: "/blackjack" },
    { key: "chart", name: "Chart trainer", href: "/blackjack/chart" },
    { key: "counting", name: "Card counting", href: "/blackjack/counting" },
  ];
</script>

<header class="flex flex-wrap items-end justify-between gap-4">
  <div class="flex min-w-0 flex-[1_1_20rem] flex-col gap-1">
    <span class="eyebrow">Blackjack</span>
    <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h1 class="page-title">Blackjack trainer</h1>
      <p class="page-lead">{lead}</p>
    </div>
  </div>
  <nav class="flex gap-1 rounded-full border border-ink-700 bg-ink-900 p-1" aria-label="Blackjack trainers">
    {#each tabs as tab}
      <a
        href={tab.href}
        class="rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors {current === tab.key
          ? 'bg-accent-500/15 text-accent-300'
          : 'text-ink-300 hover:text-ink-100'}"
        aria-current={current === tab.key ? "page" : undefined}>{tab.name}</a
      >
    {/each}
  </nav>
</header>
