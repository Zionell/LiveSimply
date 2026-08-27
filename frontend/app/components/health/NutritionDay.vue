<script setup lang="ts">
const props = defineProps<{
	day: INutritionDay;
}>();

const emit = defineEmits<{
	deleteMeal: [value: string];
}>();

const { locale } = useI18n();

const statusColor = computed((): UiColors => {
	if (props.day.status === EDeviationStatus.OnTarget) {
		return UiColors.success;
	}

	return props.day.status === EDeviationStatus.Over ? UiColors.error : UiColors.warning;
});

const label = computed((): string =>
	new Intl.DateTimeFormat(locale.value, {
		day: "2-digit",
		month: "long",
		timeZone: "UTC",
	}).format(new Date(props.day.date)),
);

const deviationLabel = computed((): string =>
	props.day.deviationKcal > 0 ? `+${props.day.deviationKcal}` : String(props.day.deviationKcal),
);
</script>

<template>
	<CommonCardWrapper>
		<template #header>
			<div class="flex flex-wrap items-baseline gap-3">
				<span class="capitalize">{{ label }}</span>

				<UBadge :color="statusColor" variant="subtle">
					{{ $t(`health.status.${props.day.status}`) }}
				</UBadge>

				<span class="text-sm font-normal text-gray-400">
					{{ props.day.fact.kcal }} / {{ props.day.target.kcal }} ({{ deviationLabel }})
				</span>
			</div>
		</template>

		<HealthMealsTable :meals="props.day.meals" @delete="emit('deleteMeal', $event)" />
	</CommonCardWrapper>
</template>
