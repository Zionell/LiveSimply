<script setup lang="ts">
import { api } from "~~/lib/api";

const props = defineProps<{
	modelValue: string | null;
}>();

const emit = defineEmits<{
	"update:modelValue": [value: string | null];
}>();

const { t } = useI18n();

const { data: products, error } = await useFetch<IProduct[]>(api.health.products, {
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
	<div class="w-full">
		<USelectMenu
			class="w-full"
			size="md"
			:model-value="props.modelValue"
			:items="items"
			value-key="value"
			:disabled="Boolean(error)"
			:placeholder="$t('health.nutrition.product')"
			virtualize
			@update:model-value="emit('update:modelValue', $event)"
		/>

		<p v-if="error" class="text-xs text-red-500 mt-1">
			{{ $t("health.nutrition.catalogueError") }}
		</p>
	</div>
</template>
