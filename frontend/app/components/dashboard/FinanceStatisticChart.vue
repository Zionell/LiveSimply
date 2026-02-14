<script setup lang="ts">
import type { IChart } from "@/pages/dashboard/index.vue";
import { splitThousandsFloat } from "~/assets/utils/numbers";

interface IPreparedData {
	percentages: number[];
	labels: Record<string, BulletLegendItemInterface>;
}

const props = defineProps<{
	data: IChart[];
	totalExpense: number;
}>();

const userStore = useUserStore();

const prepareData = computed((): IPreparedData => {
	const percentages: number[] = [];
	const labels: Record<string, BulletLegendItemInterface> = {};

	props.data.forEach((d) => {
		percentages.push(d.value);

		labels[d.label] = { name: d.label, color: d.color };
	});

	return { percentages, labels };
});
</script>

<template>
	<CommonCardWrapper>
		<template #header>
			{{ $t("charts.chartExpensesTitle") }}
		</template>

		<DonutChart
			:data="prepareData.percentages"
			:categories="prepareData.labels"
			:height="300"
			xLabel="Month"
			:legend-position="LegendPosition.TopLeft"
			:legend-style="{ padding: '8px' }"
		>
			<div class="text-center">
				<div class="font-semibold">
					{{ $t("dashboard.totalExpense") }}
				</div>
				<div class="text-muted">
					{{ splitThousandsFloat(totalExpense) }}&nbsp;
					{{ userStore.user?.exchange }}
				</div>
			</div>
		</DonutChart>
	</CommonCardWrapper>
</template>
