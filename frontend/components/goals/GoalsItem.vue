<script setup lang="ts">
import type { IGoal } from "@/types/goals.ts";
import { splitThousands, splitThousandsFloat } from "@/assets/utils/numbers.ts";
import { UiColors } from "@/types";
import { checkExpiry } from "@/assets/utils/date.ts";

interface IBadgeProps {
	label: string | number;
	color: UiColors;
}

const props = defineProps<{
	goal: IGoal;
	isActive: boolean;
}>();

const emit = defineEmits(["click"]);

const { t } = useI18n();

const getGoalStatus = computed((): IBadgeProps => {
	if (props.goal.isCompleted) {
		return {
			label: t("goals.status.completed"),
			color: UiColors.success,
		};
	}

	const isExpired = checkExpiry(props.goal.untilAt);
	if (isExpired) {
		return {
			label: t("goals.status.expired"),
			color: UiColors.error,
		};
	}

	return {
		label: t("goals.status.inProgress"),
		color: UiColors.primary,
	};
});
</script>

<template>
	<CardWrapper
		:class="{ 'cursor-pointer': !props.isActive }"
		@click="emit('click', props.goal)"
	>
		<template #header>
			<div class="flex items-center justify-between">
				{{ props.goal.title }}
				<UBadge v-bind="getGoalStatus" />
			</div>
		</template>
		<div class="flex flex-col gap-3">
			<div class="text-xs">
				{{ splitThousandsFloat(goal.amount) }} &nbsp;/&nbsp;
				{{ splitThousands(goal.total) }} {{ goal.exchangeId }}
			</div>
		</div>
	</CardWrapper>
</template>
