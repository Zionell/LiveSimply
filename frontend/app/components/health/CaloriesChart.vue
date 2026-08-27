<script setup lang="ts">
const props = defineProps<{
	points: INutritionPoint[];
}>();

const { t, locale } = useI18n();

const categories = computed((): Record<string, BulletLegendItemInterface> => ({
	kcal: { name: t("health.nutrition.fact"), color: "#22c55e" },
	target: { name: t("health.nutrition.target"), color: "#64748b" },
}));

const hasData = computed((): boolean => props.points.length > 0);

function formatDate(tick: number): string {
	const point = props.points[Math.round(tick)];

	if (!point) {
		return "";
	}

	return new Intl.DateTimeFormat(locale.value, {
		day: "2-digit",
		month: "2-digit",
		timeZone: "UTC",
	}).format(new Date(point.date));
}

function formatKcal(tick: number): string {
	return String(Math.round(tick));
}
</script>

<template>
	<CommonCardWrapper>
		<template #header>{{ $t("health.nutrition.caloriesChartTitle") }}</template>

		<p v-if="!hasData" class="text-sm text-gray-500">{{ $t("health.nutrition.chartEmpty") }}</p>

		<BarChart
			v-else
			:data="props.points"
			:categories="categories"
			:y-axis="['kcal', 'target']"
			:height="320"
			:x-num-ticks="6"
			:legend-position="LegendPosition.TopLeft"
			:x-formatter="formatDate"
			:y-formatter="formatKcal"
		/>
	</CommonCardWrapper>
</template>
