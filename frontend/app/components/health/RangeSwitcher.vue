<script setup lang="ts">
const props = defineProps<{
	modelValue: number | null;
}>();

const emit = defineEmits<{
	"update:modelValue": [value: number | null];
}>();

const { t } = useI18n();

const items = computed(() => [
	{ label: t("health.range.30"), value: 30 },
	{ label: t("health.range.90"), value: 90 },
	{ label: t("health.range.all"), value: null },
]);
</script>

<template>
	<div class="flex items-center gap-2">
		<UButton
			v-for="item in items"
			:key="String(item.value)"
			size="xs"
			:variant="props.modelValue === item.value ? 'solid' : 'ghost'"
			@click="emit('update:modelValue', item.value)"
		>
			{{ item.label }}
		</UButton>
	</div>
</template>
