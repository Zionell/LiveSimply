<script setup lang="ts">
import { api } from "~~/lib/api";

const { t } = useI18n();
const toast = useToast();

const rangeDays = ref<number | null>(90);
const granularity = ref<EGranularity>(EGranularity.Day);

const HEALTH_HISTORY_EPOCH = "1970-01-01";

const nutritionParams = computed(() => {
	const to = new Date();
	const from =
		rangeDays.value === null
			? HEALTH_HISTORY_EPOCH
			: new Date(to.getTime() - rangeDays.value * 24 * 60 * 60 * 1000)
					.toISOString()
					.slice(0, 10);

	return {
		from,
		to: to.toISOString().slice(0, 10),
		granularity: granularity.value,
	};
});

const { data: profile, error, refresh: refreshProfile } = await useFetch<THealthProfileResponse>(
	api.health.profile,
	{ key: "HealthProfile" },
);

const { data: log, refresh: refreshLog } = await useFetch<INutritionLog>(api.health.nutrition, {
	key: "HealthNutritionLog",
	params: nutritionParams,
});

if (error.value) {
	throw createError({
		statusCode: error.value?.statusCode,
		statusMessage: error.value?.statusMessage,
	});
}

const isConfigured = computed((): boolean => Boolean(profile.value?.isConfigured));

async function refreshAll() {
	await Promise.all([refreshProfile(), refreshLog()]);
}

async function handleDeleteMeal(id: string) {
	try {
		await $fetch(api.health.meal(id), { method: "DELETE" });

		await refreshAll();
		toast.add({ title: t("common.deleted"), color: "success", icon: "i-lucide-circle-check" });
	} catch (e) {
		console.warn("Health nutrition / handleDeleteMeal: ", e);
		toast.add({ title: t("common.error"), color: "error" });
	}
}
</script>

<template>
	<section class="grid gap-4">
		<h1 class="lg:text-3xl text-2xl font-bold">{{ $t("routes.health") }}</h1>

		<HealthTabs />

		<CommonSectionHeader>
			<ModalsAddMeal v-if="isConfigured" @refresh="refreshAll" />
		</CommonSectionHeader>

		<CommonSuspenseWrapper>
			<HealthEmptyProfile v-if="!isConfigured" />

			<div v-else-if="profile?.isConfigured" class="grid gap-6">
				<HealthNormCard :profile="profile" />
				<HealthNutritionTotals v-if="log" :totals="log.totals" />
			</div>
		</CommonSuspenseWrapper>
	</section>
</template>
