<script setup lang="ts">
const store = useNotificationsStore();
const { list, unreadCount } = storeToRefs(store);

onMounted(() => {
	store.fetchNotifications();
});
</script>

<template>
	<UPopover>
		<UChip :text="unreadCount" :show="unreadCount > 0" size="lg">
			<UButton color="neutral" variant="ghost" icon="i-lucide-bell" :aria-label="$t('notifications.title')" />
		</UChip>

		<template #content>
			<div class="w-80 max-h-96 overflow-y-auto p-2 grid gap-2">
				<div class="flex items-center justify-between px-1">
					<span class="text-sm font-medium">{{ $t("notifications.title") }}</span>

					<UButton
						v-if="unreadCount > 0"
						size="xs"
						variant="ghost"
						:label="$t('notifications.markAllRead')"
						@click="store.markAllRead()"
					/>
				</div>

				<p v-if="!list.length" class="text-sm text-gray-500 px-1 py-4">
					{{ $t("notifications.empty") }}
				</p>

				<button
					v-for="item in list"
					:key="item.id"
					type="button"
					class="text-left rounded-md p-2 transition-colors hover:bg-gray-800"
					:class="{ 'opacity-60': item.isReaded }"
					@click="store.markRead(item.id)"
				>
					<div class="flex items-start gap-2">
						<span
							class="mt-1.5 inline-block w-2 h-2 rounded-full shrink-0"
							:class="item.isReaded ? 'bg-transparent' : 'bg-primary-500'"
						/>
						<span class="grid gap-1">
							<span class="text-sm">{{ item.title }}</span>
							<span class="text-xs text-gray-400">{{ item.text }}</span>
						</span>
					</div>
				</button>
			</div>
		</template>
	</UPopover>
</template>
