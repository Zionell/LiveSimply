<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";
import { ERoutes } from "@/types/routes.ts";

const { t } = useI18n();
const userStore = useUserStore();

const dropdownLinks = computed((): DropdownMenuItem[][] => {
	return [
		[
			{
				label: userStore.user?.email,
				slot: "account",
				disabled: true,
			},
		],
		[
			{
				label: t("headerDropdown.profile"),
				icon: "i-heroicons:user-16-solid",
				to: ERoutes.profile,
			},
		],
		[
			{
				label: t("headerDropdown.signOut"),
				icon: "i-heroicons-arrow-left-on-rectangle",
				onSelect: () => userStore.signOut(),
			},
		],
	];
});
</script>

<template>
	<UDropdownMenu
		class="hidden lg:flex"
		:items="dropdownLinks"
		:ui="{
			item: 'data-disabled:cursor-text data-disabled:select-text',
			content: 'min-w-xs',
		}"
		:popper="{ placement: 'bottom-start' }"
	>
		<UAvatar
			:src="userStore.user?.image || ''"
			:alt="userStore.user?.name"
			size="lg"
		/>

		<template #account="{ item }">
			<div class="text-left">
				<p>{{ $t("headerDropdown.signedAs") }}</p>
				<p class="truncate font-medium">
					{{ item.label }}
				</p>
			</div>
		</template>

		<template #item="{ item }">
			<span class="truncate">{{ item.label }}</span>

			<UIcon
				v-if="item?.icon"
				:name="item.icon"
				class="flex-shrink-0 h-4 w-4 text-gray-400 ms-auto"
			/>
		</template>
	</UDropdownMenu>
</template>
