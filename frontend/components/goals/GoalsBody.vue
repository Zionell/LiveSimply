<script setup lang="ts">
import type { IGoal } from "@/types/goals.ts";

const props = defineProps<{
	goals: IGoal[];
	loading: boolean;
}>();

const emit = defineEmits(["refresh"]);

const activeGoal = ref<IGoal | null>(null);

if (props.goals?.[0]) {
	activeGoal.value = props.goals[0];
}

function setActiveGoal(goal: IGoal) {
	activeGoal.value = goal;
}
</script>

<template>
	<article class="grid md:grid-cols-[1fr_3fr] w-full lg:gap-6 gap-4">
		<GoalsList
			:goals="props.goals"
			:activeGoal="activeGoal"
			@setActiveGoal="setActiveGoal"
		/>

		<GoalsDetail
			v-if="activeGoal"
			:goal="activeGoal"
			@refresh="emit('refresh')"
		/>
	</article>
</template>
