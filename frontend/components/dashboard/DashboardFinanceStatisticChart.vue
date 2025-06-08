<script setup lang="ts">
import { splitThousandsFloat } from "@/assets/utils/numbers.ts";
import type { IChart } from "@/pages/dashboard/index.vue";

interface ILabel {
	name: string;
	color: string;
}

interface IPreparedData {
	percentages: number[];
	labels: ILabel[];
}

const props = defineProps<{
	data: IChart[];
	totalExpense: number;
}>();

const userStore = useUserStore();

const prepareData = computed((): IPreparedData => {
	const percentages: number[] = [];
	const labels: ILabel[] = [];

	props.data.forEach((d) => {
		percentages.push(d.value);
		labels.push({ name: d.label, color: d.color });
	});

	return { percentages, labels };
});
</script>

<template>
	<CardWrapper>
		<template #header>
			{{ $t("charts.chartExpensesTitle") }}
		</template>

		<DonutChart
			:data="prepareData.percentages"
			:height="275"
			:radius="0"
			:type="'full'"
			:labels="prepareData.labels"
		>
			<div class="absolute text-center">
				<div class="font-semibold">
					{{ $t("dashboard.totalExpense") }}
				</div>
				<div class="text-(--ui-text-muted)">
					{{ splitThousandsFloat(totalExpense) }}&nbsp;
					{{ userStore.user?.exchange }}
				</div>
			</div>
		</DonutChart>
	</CardWrapper>
</template>
