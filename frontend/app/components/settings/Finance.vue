<script setup lang="ts">
import { api } from "~~/lib/api";
import { splitThousandsFloat } from "~/assets/utils/numbers";
import { getError } from "~/assets/utils/common.ts";

const { t } = useI18n();
const toast = useToast();
const userStore = useUserStore();

const isBalanceLoading = ref<boolean>(false);
const isTableLoading = ref<boolean>(false);

const balance = computed((): string => {
	const total = userStore.user?.total || 0;

	return `${splitThousandsFloat(total)} ${userStore.user?.exchange || ""}`.trim();
});

async function resetBalance() {
	try {
		isBalanceLoading.value = true;

		await userStore.updateUser({ total: 0 });

		toast.add({
			title: t("settings.finance.balanceReset"),
			color: "success",
			icon: "i-lucide-circle-check",
		});
	} catch (e) {
		console.warn("Settings finance / resetBalance: ", e);
		toast.add({
			title: getError(e) || t("common.error"),
			color: "error",
		});
	} finally {
		isBalanceLoading.value = false;
	}
}

async function resetTable() {
	try {
		isTableLoading.value = true;

		await $fetch(api.finance.reset, { method: "DELETE" });

		toast.add({
			title: t("settings.finance.tableReset"),
			color: "success",
			icon: "i-lucide-circle-check",
		});
	} catch (e) {
		console.warn("Settings finance / resetTable: ", e);
		toast.add({
			title: getError(e) || t("common.error"),
			color: "error",
		});
	} finally {
		isTableLoading.value = false;
	}
}
</script>

<template>
	<div class="grid gap-4">
		<SettingsResetCard
			:title="$t('settings.finance.balanceTitle')"
			:description="$t('settings.finance.balanceDescription', { balance })"
			:confirm-title="$t('settings.finance.balanceConfirmTitle')"
			:confirm-text="$t('settings.finance.balanceConfirmText')"
			:button-label="$t('settings.finance.balanceButton')"
			:is-loading="isBalanceLoading"
			@confirm="resetBalance"
		/>

		<SettingsResetCard
			:title="$t('settings.finance.tableTitle')"
			:description="$t('settings.finance.tableDescription')"
			:confirm-title="$t('settings.finance.tableConfirmTitle')"
			:confirm-text="$t('settings.finance.tableConfirmText')"
			:button-label="$t('settings.finance.tableButton')"
			:is-loading="isTableLoading"
			@confirm="resetTable"
		/>
	</div>
</template>
