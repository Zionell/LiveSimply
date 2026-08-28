<script setup lang="ts">
const props = defineProps<{
	modelValue: EGranularity;
}>();

const emit = defineEmits<{
	"update:modelValue": [value: EGranularity];
}>();

const { t } = useI18n();

const items = computed(() => [
	{ label: t("health.granularity.day"), value: EGranularity.Day },
	{ label: t("health.granularity.week"), value: EGranularity.Week },
	{ label: t("health.granularity.month"), value: EGranularity.Month },
]);
</script>

<template>
	<div class="flex items-center gap-2">
		<UButton
			v-for="item in items"
			:key="item.value"
			size="xs"
			:variant="props.modelValue === item.value ? 'solid' : 'ghost'"
			@click="emit('update:modelValue', item.value)"
		>
			{{ item.label }}
		</UButton>
	</div>
</template>
