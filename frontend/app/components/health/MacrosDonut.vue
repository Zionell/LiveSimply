<script setup lang="ts">
const props = defineProps<{
	totals: INutritionTotals;
}>();

const { t } = useI18n();

const categories = computed((): Record<string, BulletLegendItemInterface> => ({
	protein: { name: t("health.protein"), color: "#3b82f6" },
	fat: { name: t("health.fat"), color: "#f97316" },
	carbs: { name: t("health.carbs"), color: "#a855f7" },
}));

const data = computed((): number[] => [
	props.totals.avgProteinG,
	props.totals.avgFatG,
	props.totals.avgCarbsG,
]);

const hasData = computed((): boolean => props.totals.daysLogged > 0);
</script>

<template>
	<CommonCardWrapper>
		<template #header>{{ $t("health.nutrition.macrosChartTitle") }}</template>

		<p v-if="!hasData" class="text-sm text-gray-500">{{ $t("health.nutrition.chartEmpty") }}</p>

		<DonutChart
			v-else
			:data="data"
			:categories="categories"
			:radius="140"
			:arc-width="34"
			:height="320"
			:legend-position="LegendPosition.TopLeft"
		/>
	</CommonCardWrapper>
</template>
