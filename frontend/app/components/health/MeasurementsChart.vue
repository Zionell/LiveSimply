<script setup lang="ts">
const props = defineProps<{
	points: IMeasurementPoint[];
}>();

const { t, locale } = useI18n();

const categories = computed((): Record<string, BulletLegendItemInterface> => ({
	chest: { name: t("health.chest"), color: "#3b82f6" },
	waist: { name: t("health.waist"), color: "#f97316" },
	arm: { name: t("health.arm"), color: "#a855f7" },
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

function formatCm(tick: number): string {
	return String(Math.round(tick));
}
</script>

<template>
	<CommonCardWrapper>
		<template #header>{{ $t("health.measurementsChartTitle") }}</template>

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
			:y-formatter="formatCm"
		/>
	</CommonCardWrapper>
</template>
