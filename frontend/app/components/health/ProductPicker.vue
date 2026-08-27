<script setup lang="ts">
import { api } from "~~/lib/api";

const props = defineProps<{
	modelValue: string | null;
}>();

const emit = defineEmits<{
	"update:modelValue": [value: string | null];
}>();

const { t } = useI18n();

const { data: products } = await useFetch<IProduct[]>(api.health.products, {
	key: "HealthProducts",
});

const items = computed(() =>
	(products.value || []).map((product) => ({
		label: `${product.title} · ${product.kcalPer100} ${t("health.nutrition.per100")}`,
		value: product.id,
	})),
);
</script>

<template>
	<USelectMenu
		class="w-full"
		size="md"
		:model-value="props.modelValue"
		:items="items"
		value-key="value"
		:placeholder="$t('health.nutrition.product')"
		virtualize
		@update:model-value="emit('update:modelValue', $event)"
	/>
</template>
