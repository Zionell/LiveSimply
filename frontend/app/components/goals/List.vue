<script setup lang="ts">
const props = defineProps<{
	goals: IGoal[];
	activeGoal: IGoal | null;
}>();

const emit = defineEmits(["setActiveGoal"]);
</script>

<template>
	<div class="grid gap-4 h-fit">
		<GoalsItem
			v-for="goal in props.goals"
			:key="goal.id"
			:isActive="props.activeGoal?.id === goal.id"
			:goal="goal"
			@click="emit('setActiveGoal', $event)"
		/>
	</div>
</template>
