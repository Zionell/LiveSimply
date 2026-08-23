<script setup lang="ts">
import { api } from "~~/lib/api";

const { t } = useI18n();
const toast = useToast();

const { data, pending, error, refresh } = useFetch<INotificationSetting[]>(api.notifications.settings, {
	key: "NotificationSettings",
	lazy: true,
	server: false,
});

const pendingGroup = ref<string>("");

async function toggle(group: string, isEmailEnabled: boolean) {
	try {
		pendingGroup.value = group;

		data.value = await $fetch<INotificationSetting[]>(api.notifications.settings, {
			method: "PATCH",
			body: JSON.stringify({ group, isEmailEnabled }),
		});

		toast.add({
			title: t("common.updated"),
			color: "success",
			icon: "i-lucide-circle-check",
		});
	} catch (e) {
		console.warn("Settings notifications / toggle: ", e);
		toast.add({ title: t("common.error"), color: "error" });
		await refresh();
	} finally {
		pendingGroup.value = "";
	}
}
</script>

<template>
	<CommonCardWrapper>
		<template #header>{{ $t("settings.notifications.title") }}</template>

		<p class="text-sm text-gray-400 mb-4">
			{{ $t("settings.notifications.description") }}
		</p>

		<div v-if="error" class="flex items-center justify-between gap-4">
			<span class="text-sm text-gray-400">{{ $t("common.error") }}</span>

			<UButton variant="subtle" size="sm" icon="i-lucide-refresh-cw" :loading="pending" @click="refresh()">
				{{ $t("common.retry") }}
			</UButton>
		</div>

		<CommonSuspenseWrapper v-else :loading="pending">
			<div class="grid gap-4">
				<div
					v-for="setting in data"
					:key="setting.group"
					class="flex items-center justify-between gap-4 border-t border-gray-800 pt-4 first:border-0 first:pt-0"
				>
					<div>
						<div class="text-sm">{{ $t(`settings.notifications.groups.${setting.group}.label`) }}</div>
						<div class="text-xs text-gray-400">
							{{ $t(`settings.notifications.groups.${setting.group}.hint`) }}
						</div>
					</div>

					<USwitch
						:model-value="setting.isEmailEnabled"
						:disabled="pendingGroup === setting.group"
						:aria-label="$t('settings.notifications.emailLabel')"
						@update:model-value="toggle(setting.group, $event)"
					/>
				</div>
			</div>
		</CommonSuspenseWrapper>
	</CommonCardWrapper>
</template>
