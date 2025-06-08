<script setup lang="ts">
import { api } from "@/lib/api.ts";
import type { IGoal } from "@/types/goals.ts";
import { countPercentage } from "@/assets/utils/numbers.ts";
import { colorByPercent } from "@/assets/utils/common.ts";

const { data, error } = await useFetch<IGoal[]>(api.goals.common);

if (error.value) {
	throw createError({
		statusCode: error.value?.statusCode,
		statusMessage: error.value?.statusMessage,
	});
}

function getGoalStatus(goal: IGoal) {
	const percentage = countPercentage(goal.amount, goal.total);
	return {
		value: percentage,
		color: colorByPercent(percentage),
	};
}
</script>

<template>
	<CardWrapper>
		<template #header>
			{{ $t("dashboard.goals") }}
		</template>

		<div class="grid grid-cols-2 gap-4 items-center">
			<div
				v-for="goal in data"
				:key="goal.id"
				class="grid grid-cols-2 gap-2 items-center justify-center"
			>
				<UProgress
					size="xl"
					v-model="getGoalStatus(goal).value"
					:color="getGoalStatus(goal).color"
				/>
				<h3 class="lg:text-base text-sm lg:font-bold">
					{{ goal.title }}
				</h3>
			</div>
		</div>
	</CardWrapper>
</template>
