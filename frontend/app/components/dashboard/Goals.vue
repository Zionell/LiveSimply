<script setup lang="ts">
import { api } from "~~/lib/api";
import { countPercentage } from "~/assets/utils/numbers";
import { colorByPercent } from "~/assets/utils/common";

const { data, pending, error } = await useFetch<IGoal[]>(api.goals.common, {
	lazy: true,
	server: false,
});

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
	<CommonCardWrapper>
		<template #header> {{ $t("dashboard.goals") }} </template>

		<CommonSuspenseWrapper :loading="pending" :error="error">
			<div class="grid grid-cols-2 gap-4 items-center">
				<NuxtLink
					v-for="goal in data"
					:key="goal.id"
					:href="`/goals/?id=${goal.id}`"
					class="grid grid-cols-2 gap-2 items-center justify-center"
				>
					<UTooltip :text="`${getGoalStatus(goal).value.toString()}%`" :delay-duration="0">
						<UProgress size="xl" v-model="getGoalStatus(goal).value" :color="getGoalStatus(goal).color" />
					</UTooltip>
					<h3 class="lg:text-base text-sm lg:font-bold">
						{{ goal.title }}
					</h3>
				</NuxtLink>
			</div>
		</CommonSuspenseWrapper>
	</CommonCardWrapper>
</template>
