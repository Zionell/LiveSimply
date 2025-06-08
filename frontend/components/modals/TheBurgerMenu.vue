<script setup lang="ts">
import { ERoutes } from "@/types/routes.ts";
import LanguageChange from "@/components/common/LanguageChange.vue";
import { navigation } from "@/assets/constants/menu.ts";

const { t } = useI18n();
const userStore = useUserStore();
const isOpen = ref<boolean>(false);
const isLoading = ref<boolean>(false);

const links = computed(() =>
	navigation.map((nav) => ({ ...nav, label: t(`routes.${nav.key}`) })),
);

async function handleClick() {
	try {
		isLoading.value = true;
		await userStore.signOut();
	} catch (e) {
		console.warn("handleClick", e);
	} finally {
		isLoading.value = false;
	}
}
</script>

<template>
	<USlideover class="lg:hidden" v-model:open="isOpen">
		<UButton
			icon="material-symbols-light:menu-rounded"
			@click="isOpen = true"
		/>

		<template #header>
			<div class="flex justify-between items-center w-full">
				<ULink :to="ERoutes.dashboard" class="h-4">
					<LogoIcon />
				</ULink>

				<UButton
					icon="material-symbols:close-rounded"
					@click="isOpen = false"
				/>
			</div>
		</template>

		<template #body>
			<div class="flex flex-col gap-8">
				<div class="flex gap-4 items-center justify-between">
					<UAvatar
						:src="userStore.user?.image || ''"
						:alt="userStore.user?.name"
						size="lg"
					/>

					<div class="grow" v-html="userStore.user?.name" />

					<UButton :loading="isLoading" @click="handleClick">
						{{ $t("headerDropdown.signOut") }}
					</UButton>
				</div>

				<UNavigationMenu
					orientation="vertical"
					class="grow"
					:items="links"
				/>
			</div>
		</template>

		<template #footer>
			<LanguageChange />
		</template>
	</USlideover>
</template>
