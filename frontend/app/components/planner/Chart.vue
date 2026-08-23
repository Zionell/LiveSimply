<script setup lang="ts">
import { shortThousands } from "~/assets/utils/numbers";

const props = defineProps<{
	planner: IPlanner;
}>();

const { t } = useI18n();

const categories = computed((): Record<string, BulletLegendItemInterface> => ({
	income: { name: t("financePlanner.chartIncome"), color: "#22c55e" },
	expense: { name: t("financePlanner.chartExpense"), color: "#ef4444" },
}));

const hasData = computed((): boolean => props.planner.chart.some((point) => point.income > 0 || point.expense > 0));

function formatDay(tick: number): string {
	return String(props.planner.chart[Math.round(tick)]?.day ?? "");
}

function formatAmount(tick: number): string {
	return shortThousands(tick);
}
</script>

<template>
	<CommonCardWrapper>
		<template #header>{{ $t("financePlanner.chartTitle") }}</template>

		<p v-if="!hasData" class="text-sm text-gray-500">
			{{ $t("financePlanner.chartEmpty") }}
		</p>

		<LineChart
			v-else
			:data="props.planner.chart"
			:categories="categories"
			:height="320"
			:x-num-ticks="6"
			:curve-type="CurveType.Linear"
			:legend-position="LegendPosition.TopLeft"
			:x-formatter="formatDay"
			:y-formatter="formatAmount"
		/>
	</CommonCardWrapper>
</template>
