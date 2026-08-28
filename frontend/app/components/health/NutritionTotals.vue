<script setup lang="ts">
import { splitThousands } from "~/assets/utils/numbers";

const props = defineProps<{
	totals: INutritionTotals;
}>();

const { t } = useI18n();

const cards = computed(() => [
	{ label: "health.nutrition.avgKcal", value: splitThousands(props.totals.avgKcal) },
	{ label: "health.protein", value: `${props.totals.avgProteinG} ${t("health.gram")}` },
	{ label: "health.fat", value: `${props.totals.avgFatG} ${t("health.gram")}` },
	{ label: "health.carbs", value: `${props.totals.avgCarbsG} ${t("health.gram")}` },
	{ label: "health.nutrition.daysLogged", value: String(props.totals.daysLogged) },
	{ label: "health.nutrition.onTargetDays", value: String(props.totals.onTargetDays) },
]);
</script>

<template>
	<CommonCardWrapper>
		<div class="grid sm:grid-cols-3 lg:grid-cols-6 gap-4">
			<div v-for="card in cards" :key="card.label">
				<div class="text-xs text-gray-400">{{ $t(card.label) }}</div>
				<div class="text-lg">{{ card.value }}</div>
			</div>
		</div>
	</CommonCardWrapper>
</template>
