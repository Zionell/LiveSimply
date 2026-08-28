<script setup lang="ts">
const props = defineProps<{
	points: INutritionPoint[];
}>();

const { t, locale } = useI18n();

/**
 * БЖУ — три линии в граммах: кольцо показывало только средние доли за весь
 * период и не отвечало на главный вопрос — растёт белок или проседает.
 */
const categories = computed((): Record<string, BulletLegendItemInterface> => ({
	proteinG: { name: t("health.protein"), color: "#3b82f6" },
	fatG: { name: t("health.fat"), color: "#f97316" },
	carbsG: { name: t("health.carbs"), color: "#a855f7" },
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

const tooltipRows = computed(
	(): { key: "proteinG" | "fatG" | "carbsG"; label: string; color: string }[] => [
		{ key: "proteinG", label: t("health.protein"), color: "#3b82f6" },
		{ key: "fatG", label: t("health.fat"), color: "#f97316" },
		{ key: "carbsG", label: t("health.carbs"), color: "#a855f7" },
	]
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

function formatGrams(tick: number): string {
	return String(Math.round(tick));
}
</script>

<template>
	<CommonCardWrapper>
		<template #header>{{ $t("health.nutrition.macrosChartTitle") }}</template>

		<p v-if="!hasData" class="text-sm text-gray-500">{{ $t("health.nutrition.chartEmpty") }}</p>

		<LineChart
			v-else
			:data="props.points"
			:categories="categories"
			:height="320"
			:x-num-ticks="6"
			:curve-type="CurveType.Linear"
			:legend-position="LegendPosition.TopLeft"
			:x-formatter="formatDate"
			:y-formatter="formatGrams"
			:tooltip-title-formatter="formatTooltipTitle"
		>
			<!--
				Разметка тултипа копируется в контейнер графика через innerHTML,
				поэтому здесь только статические классы — обработчики и реактивность
				внутрь не переживают копирование.
			-->
			<template #tooltip="{ values }">
				<div v-if="values" class="p-3 text-sm">
					<p class="font-semibold pb-2 mb-2 border-b border-gray-200 dark:border-gray-700">
						{{ formatTooltipTitle(values) }}
					</p>

					<div class="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1">
						<template v-for="row in tooltipRows" :key="row.key">
							<span class="size-2 rounded-full" :style="{ backgroundColor: row.color }" />
							<span class="text-gray-500">{{ row.label }}</span>
							<span class="font-semibold tabular-nums text-right">
								{{ values[row.key] }} {{ $t("health.gram") }}
							</span>
						</template>
					</div>
				</div>
			</template>
		</LineChart>
	</CommonCardWrapper>
</template>
