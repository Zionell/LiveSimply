<script setup lang="ts">
const props = defineProps<{
	points: INutritionPoint[];
}>();

const { t, locale } = useI18n();

/**
 * Съеденное — столбцы, цель — линия поверх них. Цель в норме постоянна,
 * и второй серией столбцов она превращалась в стену одинаковых полос,
 * которая ничего не сообщает и вдвое загущает график.
 */
const barCategories = computed((): Record<string, BulletLegendItemInterface> => ({
	kcal: { name: t("health.nutrition.fact"), color: "#22c55e" },
}));

const lineCategories = computed((): Record<string, BulletLegendItemInterface> => ({
	target: { name: t("health.nutrition.target"), color: "#94a3b8" },
}));

const hasData = computed((): boolean => props.points.length > 0);

const dayFormatter = computed(
	(): Intl.DateTimeFormat =>
		new Intl.DateTimeFormat(locale.value, {
			day: "2-digit",
			month: "2-digit",
			timeZone: "UTC",
		})
);

function formatDate(tick: number): string {
	const point = props.points[Math.round(tick)];

	if (!point) {
		return "";
	}

	return dayFormatter.value.format(new Date(point.date));
}

function formatTooltipTitle(point: INutritionPoint): string {
	if (!point?.date) {
		return "";
	}

	return dayFormatter.value.format(new Date(point.date));
}

function formatKcal(tick: number): string {
	return String(Math.round(tick));
}
</script>

<template>
	<CommonCardWrapper>
		<template #header>{{ $t("health.nutrition.caloriesChartTitle") }}</template>

		<p v-if="!hasData" class="text-sm text-gray-500">{{ $t("health.nutrition.chartEmpty") }}</p>

		<DualChart
			v-else
			:data="props.points"
			:bar-categories="barCategories"
			:line-categories="lineCategories"
			:bar-y-axis="['kcal']"
			:line-y-axis="['target']"
			:height="320"
			:x-num-ticks="6"
			:bar-padding="0.25"
			:curve-type="CurveType.Linear"
			:legend-position="LegendPosition.TopLeft"
			:x-formatter="formatDate"
			:y-formatter="formatKcal"
			:tooltip-title-formatter="formatTooltipTitle"
		/>
	</CommonCardWrapper>
</template>
