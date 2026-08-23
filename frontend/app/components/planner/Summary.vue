<script setup lang="ts">
import { splitThousandsFloat } from "~/assets/utils/numbers";

const props = defineProps<{
	planner: IPlanner;
}>();

const percent = computed((): number => Math.round(props.planner.progress * 100));

const color = computed((): UiColors => {
	if (props.planner.progress >= 1) {
		return UiColors.error;
	}

	if (props.planner.progress >= props.planner.alertThreshold) {
		return UiColors.warning;
	}

	return UiColors.success;
});

const isOverplanned = computed((): boolean => props.planner.unallocated < 0);
</script>

<template>
	<CommonCardWrapper>
		<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
			<div>
				<div class="text-xs text-gray-400">{{ $t("financePlanner.expectedIncome") }}</div>
				<div class="text-lg">
					{{ splitThousandsFloat(props.planner.expectedIncome.converted) }}
					{{ props.planner.currency }}
				</div>
			</div>

			<div>
				<div class="text-xs text-gray-400">{{ $t("financePlanner.actualIncome") }}</div>
				<div class="text-lg">
					{{ splitThousandsFloat(props.planner.actualIncome) }}
					{{ props.planner.currency }}
				</div>
			</div>

			<div>
				<div class="text-xs text-gray-400">{{ $t("financePlanner.planned") }}</div>
				<div class="text-lg">
					{{ splitThousandsFloat(props.planner.planned) }}
					{{ props.planner.currency }}
				</div>
			</div>

			<div>
				<div class="text-xs text-gray-400">{{ $t("financePlanner.spent") }}</div>
				<div class="text-lg">
					{{ splitThousandsFloat(props.planner.totalSpent) }}
					{{ props.planner.currency }}
				</div>
			</div>
		</div>

		<div class="mt-4 grid gap-2">
			<UProgress :model-value="Math.min(percent, 100)" :color="color" />

			<div class="text-xs" :class="isOverplanned ? 'text-red-400' : 'text-gray-400'">
				<template v-if="isOverplanned">
					{{
						$t("financePlanner.overplanned", {
							amount: `${splitThousandsFloat(Math.abs(props.planner.unallocated))} ${props.planner.currency}`,
						})
					}}
				</template>
				<template v-else>
					{{ $t("financePlanner.unallocated") }}:
					{{ splitThousandsFloat(props.planner.unallocated) }}
					{{ props.planner.currency }}
				</template>
			</div>
		</div>
	</CommonCardWrapper>
</template>
