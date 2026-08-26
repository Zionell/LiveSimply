<script setup lang="ts">
import type { TabsItem } from "@nuxt/ui";

const { t } = useI18n();
const route = useRoute();

const items = computed((): TabsItem[] => [
	{ label: t("health.tabs.body"), value: ERoutes.healthBody, icon: "i-lucide-scale" },
]);

const active = computed((): string => {
	const match = items.value.find((item) => route.path.startsWith(String(item.value)));

	return String(match?.value ?? ERoutes.healthBody);
});

function handleChange(value: string | number): void {
	navigateTo(String(value));
}
</script>

<template>
	<UTabs
		:items="items"
		:model-value="active"
		:content="false"
		variant="link"
		@update:model-value="handleChange"
	/>
</template>
