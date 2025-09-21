<script lang="ts">
  import RangeLayout from "@components/range/range-layout.svelte";
  import { PokerRange } from "@utils/range.svelte";

  type RangeExercise = {
    type: "range";
    ranges: string[];
    finishWithoutFailing: Number;
  };
  type HandExercise = { type: "hand"; ranges: string[] };

  type Exercise = RangeExercise | HandExercise;

  type Drill = {
    name: string;
    exercises: Exercise[];
  };
  type Category = { name: string; drills: (Drill | Category)[] };

  const drillHeaderSizes = [
    "text-6xl",
    "text-5xl",
    "text-4xl",
    "text-3xl",
    "text-2xl",
    "text-xl",
  ];

  const drills: (Drill | Category)[] = [
    {
      name: "learn range",
      drills: [
        {
          name: "25bb UTG+1/+2 vs UTG RFI",
          exercises: [
            {
              type: "range",
              ranges: ["/ranges/mtt/25/vs UTG/UTG+1.json"],
              finishWithoutFailing: 3,
            },
            { type: "hand", ranges: ["/ranges/mtt/25/vs UTG/UTG+1.json"] },
          ],
        },
        {
          name: "25bb LJ/HJ vs UTG RFI",
          exercises: [
            {
              type: "range",
              ranges: ["/ranges/mtt/25/vs UTG/LJ.json"],
              finishWithoutFailing: 3,
            },
            { type: "hand", ranges: ["/ranges/mtt/25/vs UTG/LJ.json"] },
          ],
        },
        {
          name: "25bb vs UTG RFI",
          exercises: [
            {
              type: "range",
              ranges: ["/ranges/mtt/25/vs UTG/UTG+1.json"],
              finishWithoutFailing: 3,
            },
            { type: "hand", ranges: ["/ranges/mtt/25/vs UTG/UTG+1.json"] },
            {
              type: "range",
              ranges: ["/ranges/mtt/25/vs UTG/LJ.json"],
              finishWithoutFailing: 3,
            },
            {
              type: "range",
              ranges: [
                "/ranges/mtt/25/vs UTG/UTG+1.json",
                "/ranges/mtt/25/vs UTG/LJ.json",
              ],
              finishWithoutFailing: 3,
            },
          ],
        },
      ],
    },
    {
      name: "warm up",
      drills: [
        {
          name: "25bb RFI",
          exercises: [
            {
              type: "range",
              ranges: [
                "/ranges/mtt/25/RFI/UTG.json",
                "/ranges/mtt/25/RFI/UTG+1.json",
                "/ranges/mtt/25/RFI/UTG+2.json",
                "/ranges/mtt/25/RFI/LJ.json",
                "/ranges/mtt/25/RFI/HJ.json",
                "/ranges/mtt/25/RFI/CO.json",
                "/ranges/mtt/25/RFI/BTN.json",
                "/ranges/mtt/25/RFI/SB.json",
              ],
              finishWithoutFailing: 1,
            },
            {
              type: "hand",
              ranges: [
                "/ranges/mtt/25/RFI/UTG.json",
                "/ranges/mtt/25/RFI/UTG+1.json",
                "/ranges/mtt/25/RFI/UTG+2.json",
                "/ranges/mtt/25/RFI/LJ.json",
                "/ranges/mtt/25/RFI/HJ.json",
                "/ranges/mtt/25/RFI/CO.json",
                "/ranges/mtt/25/RFI/BTN.json",
                "/ranges/mtt/25/RFI/SB.json",
              ],
            },
          ],
        },
      ],
    },
  ];

  let drillInFocus: Drill | null = $state(null);
  let exerciseInFocusIndex: number = $state(0);
  let exerciseRanges: PokerRange[] = $state([]);
  let compareTo: PokerRange | undefined = $state(undefined);
  let isCorrect: boolean = $state(false);
  let pokerRange: PokerRange = $state(new PokerRange());

  function startDrill(drill: Drill) {
    exerciseInFocusIndex = -1;
    exerciseRanges = [];
    drillInFocus = drill;
    next();
    console.log(drillInFocus);
  }

  async function next() {
    if (isCorrect) {
      exerciseRanges.shift();
    } else if (exerciseRanges[exerciseRanges.length - 1] !== compareTo) {
      exerciseRanges.push(exerciseRanges[0]);
    }

    compareTo = undefined;
    pokerRange = new PokerRange();

    if (exerciseRanges.length === 0) {
      exerciseInFocusIndex += 1;
      for (const rangePath of drillInFocus?.exercises[exerciseInFocusIndex]
        .ranges || []) {
        const response = await fetch(rangePath);
        if (response.ok) {
          const json = await response.json();
          exerciseRanges.push(PokerRange.fromJSON(json));
        }
      }
    }

    console.log(exerciseRanges);
  }

  function check() {
    compareTo = exerciseRanges[0];
    isCorrect = false;
  }
</script>

{#snippet drillSelecter(drills: (Drill | Category)[], depth = 0)}
  {#each drills as drill}
    {#if "drills" in drill}
      <div class="bg-gray-300 p-4 rounded-lg flex flex-col gap-8">
        <h2 class={drillHeaderSizes[0]}>{drill.name}</h2>
        <div class="flex flex-col">
          {@render drillSelecter(drill.drills, depth + 1)}
        </div>
      </div>
    {:else}
      <button onclick={() => startDrill(drill)}>{drill.name}</button>
    {/if}
  {/each}
{/snippet}

{#if drillInFocus}
  <button onclick={() => (drillInFocus = null)}>back</button>
  <h1 class="text-4xl text-center pb-4">
    {drillInFocus.name}
  </h1>
  {#if drillInFocus.exercises[exerciseInFocusIndex].type === "range"}
    <RangeLayout {pokerRange} {compareTo}>
      <div>
        {#if compareTo}
          <button
            class="bg-gray-300 hover:bg-gray-400 px-3 py-1 m-1 rounded"
            onclick={next}>Next</button
          >
        {:else}
          <button
            class="bg-gray-300 hover:bg-gray-400 px-3 py-1 m-1 rounded"
            onclick={check}>Check</button
          >
        {/if}
      </div>
    </RangeLayout>
  {:else}
    <p>Drill details and exercises will go here...</p>
  {/if}
{:else}
  <div class="flex flex-row gap-8">
    {@render drillSelecter(drills)}
  </div>
{/if}
