<script setup lang="ts">
const props = defineProps<{
	points: IWeightPoint[];
}>();

const { t, locale } = useI18n();

const categories = computed((): Record<string, BulletLegendItemInterface> => ({
	weight: { name: t("health.weight"), color: "#22c55e" },
	target: { name: t("health.target"), color: "#64748b" },
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

function formatWeight(tick: number): string {
	return String(Math.round(tick * 10) / 10);
}
</script>

<template>
	<CommonCardWrapper>
		<template #header>{{ $t("health.weightChartTitle") }}</template>

		<p v-if="!hasData" class="text-sm text-gray-500">{{ $t("health.chartEmpty") }}</p>

		<LineChart
			v-else
			:data="props.points"
			:categories="categories"
			:height="320"
			:x-num-ticks="6"
			:curve-type="CurveType.Linear"
			:legend-position="LegendPosition.TopLeft"
			:x-formatter="formatDate"
			:y-formatter="formatWeight"
		/>
	</CommonCardWrapper>
</template>
