<script setup lang="ts">
import { splitThousandsFloat } from "~/assets/utils/numbers";

const props = defineProps<{
	planner: IPlanner;
}>();

const { locale } = useI18n();

const periodLabel = computed((): string => {
	const date = new Date(Date.UTC(props.planner.year, props.planner.month - 1, 1));

	return new Intl.DateTimeFormat(locale.value, { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
});

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
		<h2 class="text-sm uppercase tracking-wide text-gray-400 mb-4">
			{{ $t("financePlanner.period") }}: {{ periodLabel }}
		</h2>

		<div class="grid sm:grid-cols-3 gap-4">
			<div>
				<div class="text-xs text-gray-400">{{ $t("financePlanner.income") }}</div>
				<div class="text-lg">
					{{ splitThousandsFloat(props.planner.income.converted) }}
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
