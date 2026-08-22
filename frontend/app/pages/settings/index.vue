<script setup lang="ts">
import type { TabsItem } from "@nuxt/ui";

const { t } = useI18n();

const tabs = computed((): TabsItem[] => [
	{
		label: t("settings.tabs.finance"),
		value: "finance",
		slot: "finance" as const,
		icon: "i-lucide-wallet",
	},
	{
		label: t("settings.tabs.notifications"),
		value: "notifications",
		slot: "notifications" as const,
		icon: "i-lucide-bell",
	},
]);
</script>

<template>
	<section class="grid gap-4">
		<h1 class="lg:text-3xl text-2xl font-bold">{{ $t("routes.settings") }}</h1>

		<UTabs :items="tabs" default-value="finance" variant="link" :ui="{ content: 'pt-4' }">
			<template #finance>
				<SettingsFinance />
			</template>

			<template #notifications>
				<SettingsNotifications />
			</template>
		</UTabs>
	</section>
</template>
