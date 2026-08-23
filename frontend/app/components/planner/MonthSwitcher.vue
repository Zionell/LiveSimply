<script setup lang="ts">
const props = defineProps<{
	year: number;
	month: number;
}>();

const emit = defineEmits<{
	change: [{ year: number; month: number }];
}>();

const { locale } = useI18n();

const BOUND_MONTHS = 12;

const index = computed((): number => props.year * 12 + (props.month - 1));

const currentIndex = computed((): number => {
	const now = new Date();

	return now.getUTCFullYear() * 12 + now.getUTCMonth();
});

const label = computed((): string => {
	const date = new Date(Date.UTC(props.year, props.month - 1, 1));

	return new Intl.DateTimeFormat(locale.value, {
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	}).format(date);
});

const canGoBack = computed((): boolean => index.value > currentIndex.value - BOUND_MONTHS);
const canGoForward = computed((): boolean => index.value < currentIndex.value + BOUND_MONTHS);

function shift(step: number): void {
	const next = index.value + step;

	emit("change", { year: Math.floor(next / 12), month: (next % 12) + 1 });
}
</script>

<template>
	<div class="flex items-center gap-1 mr-auto">
		<UButton
			variant="ghost"
			icon="i-lucide-chevron-left"
			:disabled="!canGoBack"
			:aria-label="$t('financePlanner.prevMonth')"
			@click="shift(-1)"
		/>

		<span class="text-sm font-medium capitalize text-center min-w-36">{{ label }}</span>

		<UButton
			variant="ghost"
			icon="i-lucide-chevron-right"
			:disabled="!canGoForward"
			:aria-label="$t('financePlanner.nextMonth')"
			@click="shift(1)"
		/>
	</div>
</template>
