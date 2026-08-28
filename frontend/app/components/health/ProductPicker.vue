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

// Личные продукты помечаем прямо в подписи: в списке они стоят вперемешку с
// общими, а отличить своё от сида иначе никак.
const items = computed(() =>
	(products.value || []).map((product) => ({
		label: [
			product.title,
			product.isOwn ? `(${t("health.nutrition.ownProduct")})` : "",
			`· ${product.kcalPer100} ${t("health.nutrition.per100")}`,
		]
			.filter(Boolean)
			.join(" "),
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
