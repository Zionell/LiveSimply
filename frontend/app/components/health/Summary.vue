<script setup lang="ts">
import { splitThousandsFloat } from "~/assets/utils/numbers";

const props = defineProps<{
	profile: IHealthProfile;
}>();

const percent = computed((): number => Math.round(props.profile.progress * 100));

const color = computed((): UiColors => {
	if (props.profile.progress >= 1) {
		return UiColors.success;
	}

	if (props.profile.progress > 0) {
		return UiColors.primary;
	}

	return UiColors.warning;
});

const cards = computed(() => [
	{ label: "health.start", value: props.profile.startWeightKg },
	{ label: "health.current", value: props.profile.currentWeightKg },
	{ label: "health.target", value: props.profile.targetWeightKg },
	{ label: "health.lost", value: props.profile.lostKg },
	{ label: "health.remaining", value: props.profile.remainingKg },
]);
</script>

<template>
	<CommonCardWrapper>
		<div class="grid sm:grid-cols-3 lg:grid-cols-5 gap-4">
			<div v-for="card in cards" :key="card.label">
				<div class="text-xs text-gray-400">{{ $t(card.label) }}</div>
				<div class="text-lg">{{ splitThousandsFloat(card.value) }} {{ $t("health.kg") }}</div>
			</div>
		</div>

		<div class="mt-4 grid gap-2">
			<UProgress :model-value="Math.min(Math.max(percent, 0), 100)" :color="color" />

			<div class="text-xs text-gray-400">{{ $t("health.progress") }}: {{ percent }}%</div>
		</div>
	</CommonCardWrapper>
</template>
