<script setup lang="ts">
import { splitThousands } from "~/assets/utils/numbers";

const props = defineProps<{
	points: INutritionPoint[];
}>();

const { t, locale } = useI18n();

/**
 * Съеденное и цель — две линии в одних осях: важна не величина каждого дня
 * сама по себе, а то, как факт идёт относительно цели. Цель пунктиром, чтобы
 * она читалась как ориентир, а не как вторая измеренная величина.
 */
const categories = computed((): Record<string, BulletLegendItemInterface> => ({
	kcal: { name: t("health.nutrition.fact"), color: "#22c55e" },
	target: { name: t("health.nutrition.target"), color: "#94a3b8" },
}));

const lineDashArray = [[], [6, 4]];

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

// Отклонение от цели — то, ради чего в этот график и смотрят. Считаем здесь,
// а не на бэкенде: обе величины уже в точке, а знак нужен только для показа.
function formatDeviation(point: INutritionPoint): string {
	const diff = Math.round(point.kcal - point.target);

	return `${diff > 0 ? "+" : ""}${splitThousands(diff)}`;
}

function deviationClass(point: INutritionPoint): string {
	return point.kcal > point.target ? "text-red-500" : "text-green-500";
}
</script>

<template>
	<CommonCardWrapper>
		<template #header>{{ $t("health.nutrition.caloriesChartTitle") }}</template>

		<p v-if="!hasData" class="text-sm text-gray-500">{{ $t("health.nutrition.chartEmpty") }}</p>

		<LineChart
			v-else
			:data="props.points"
			:categories="categories"
			:line-dash-array="lineDashArray"
			:height="320"
			:x-num-ticks="6"
			:curve-type="CurveType.Linear"
			:legend-position="LegendPosition.TopLeft"
			:x-formatter="formatDate"
			:y-formatter="formatKcal"
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
						<span class="size-2 rounded-full bg-[#22c55e]" />
						<span class="text-gray-500">{{ $t("health.nutrition.fact") }}</span>
						<span class="font-semibold tabular-nums text-right">
							{{ splitThousands(values.kcal) }} {{ $t("health.kcal") }}
						</span>

						<span class="size-2 rounded-full bg-[#94a3b8]" />
						<span class="text-gray-500">{{ $t("health.nutrition.target") }}</span>
						<span class="font-semibold tabular-nums text-right">
							{{ splitThousands(values.target) }} {{ $t("health.kcal") }}
						</span>

						<span />
						<span class="text-gray-500">{{ $t("health.nutrition.deviation") }}</span>
						<span class="font-semibold tabular-nums text-right" :class="deviationClass(values)">
							{{ formatDeviation(values) }} {{ $t("health.kcal") }}
						</span>
					</div>
				</div>
			</template>
		</LineChart>
	</CommonCardWrapper>
</template>
