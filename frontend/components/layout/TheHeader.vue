<script setup lang="ts">
import { ERoutes } from "@/types/routes.ts";

const { t } = useI18n();
const route = useRoute();

const breadcrumbs = computed(() => {
	const items = [
		{
			to: ERoutes.dashboard,
			label: t("routes.dashboard"),
		},
	];

	if (route.path !== ERoutes.dashboard) {
		items.push({
			to: route.path,
			label: t(`routes.${route.name}`),
		});
	}

	return items;
});
</script>

<template>
	<header
		class="flex justify-between h-14 lg:h-auto lg:col-span-1 w-full items-center px-4 lg:px-8 bg-gray-900 sticky top-0 z-50"
	>
		<transition name="dropdown" mode="out-in">
			<h1 v-if="route.name" :key="route.name" class="hidden lg:flex grow">
				{{ $t(`routes.${route.name}`) }}
			</h1>
		</transition>

		<UBreadcrumb class="lg:hidden" :items="breadcrumbs" />

		<TheBurgerMenu />

		<ProfileAvatar />
	</header>
</template>
