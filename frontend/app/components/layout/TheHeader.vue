<script setup lang="ts">
interface IBreadcrumbItem {
	to: string;
	label: string;
}

const { t } = useI18n();
const route = useRoute();

const routeName = computed((): string => route.name?.toString() || "dashboard");

const breadcrumbs = computed(() => {
	const items: IBreadcrumbItem[] = [
		{
			to: ERoutes.dashboard,
			label: t("routes.dashboard"),
		},
	];

	if (route.path !== ERoutes.dashboard) {
		items.push({
			to: route.path,
			label: t(`routes.${routeName}`),
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
			<h1 v-if="routeName" :key="routeName" class="hidden lg:flex grow">
				{{ $t(`routes.${routeName}`) }}
			</h1>
		</transition>

		<UBreadcrumb class="lg:hidden" :items="breadcrumbs" />

		<ModalsTheBurgerMenu />

		<LayoutNotificationsBell class="mr-4" />

		<LayoutProfileAvatar />
	</header>
</template>
