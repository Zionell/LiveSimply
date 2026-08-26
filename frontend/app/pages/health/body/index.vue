<script setup lang="ts">
import { api } from "~~/lib/api";

const { t } = useI18n();
const toast = useToast();

const rangeDays = ref<number | null>(90);

const bodyParams = computed(() => {
	if (rangeDays.value === null) {
		return {};
	}

	const to = new Date();
	const from = new Date(to.getTime() - rangeDays.value * 24 * 60 * 60 * 1000);

	return {
		from: from.toISOString().slice(0, 10),
		to: to.toISOString().slice(0, 10),
	};
});

const { data: profile, error, refresh: refreshProfile } = await useFetch<THealthProfileResponse>(
	api.health.profile,
	{ key: "HealthProfile" },
);

const { data: bodyLog, refresh: refreshBody } = await useFetch<IBodyLog>(api.health.body, {
	key: "HealthBodyLog",
	params: bodyParams,
});

if (error.value) {
	throw createError({
		statusCode: error.value?.statusCode,
		statusMessage: error.value?.statusMessage,
	});
}

const isConfigured = computed((): boolean => Boolean(profile.value?.isConfigured));

async function refreshAll() {
	await Promise.all([refreshProfile(), refreshBody()]);
}

async function handleDelete(id: string) {
	try {
		await $fetch(api.health.bodyDetail(id), { method: "DELETE" });

		await refreshAll();
		toast.add({
			title: t("common.deleted"),
			color: "success",
			icon: "i-lucide-circle-check",
		});
	} catch (e) {
		console.warn("Health body / handleDelete: ", e);
		toast.add({ title: t("common.error"), color: "error" });
	}
}
</script>

<template>
	<section class="grid gap-4">
		<h1 class="lg:text-3xl text-2xl font-bold">{{ $t("routes.health") }}</h1>

		<HealthTabs />

		<CommonSectionHeader>
			<HealthRangeSwitcher v-model="rangeDays" />

			<ModalsEditHealthProfile :profile="profile ?? null" @refresh="refreshAll" />
			<ModalsAddBodyEntry v-if="isConfigured" @refresh="refreshAll" />
		</CommonSectionHeader>

		<CommonSuspenseWrapper>
			<HealthEmptyProfile v-if="!isConfigured">
				<ModalsEditHealthProfile :profile="null" @refresh="refreshAll" />
			</HealthEmptyProfile>

			<div v-else-if="profile?.isConfigured" class="grid gap-6">
				<HealthSummary :profile="profile" />
				<HealthNormCard :profile="profile" />
				<HealthBodyTable :entries="bodyLog?.entries || []" @delete="handleDelete" />
			</div>
		</CommonSuspenseWrapper>
	</section>
</template>
