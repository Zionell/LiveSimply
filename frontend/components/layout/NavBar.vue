<script setup lang="ts">
import { navigation } from "@/assets/constants/menu.ts";
import { ERoutes } from "@/types/routes.ts";
import { ERole } from "@/types/user.ts";
import LanguageChange from "@/components/common/LanguageChange.vue";

const { t } = useI18n();

const userStore = useUserStore();

const links = computed(() =>
	navigation.map((nav) => ({ ...nav, label: t(`routes.${nav.key}`) })),
);

const isAdmin = computed(() => userStore.user?.role === ERole.ADMIN);
</script>

<template>
	<div
		class="hidden lg:flex flex-col lg:gap-8 row-span-2 w-72 h-dvh sticky top-0 z-50 bg-gray-900 py-12 px-8"
	>
		<ULink :to="ERoutes.dashboard" class="h-7 w-full">
			<LogoIcon />
		</ULink>

		<UNavigationMenu orientation="vertical" class="grow" :items="links" />

		<div v-if="isAdmin">
			<UButton variant="link" :to="ERoutes.users" class="h-7 w-full">
				Users
			</UButton>
		</div>

		<LanguageChange />
	</div>
</template>
