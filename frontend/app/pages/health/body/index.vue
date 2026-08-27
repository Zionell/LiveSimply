<script setup lang="ts">
import { api } from "~~/lib/api";

const { t } = useI18n();
const toast = useToast();

const rangeDays = ref<number | null>(90);

// "All time" has to send an explicit `from` far enough in the past that it
// genuinely covers the whole diary — an absent `from` reads on the backend as
// the default 90-day window (see HealthBodyService.list), so leaving it empty
// here would silently collapse "All time" into "90 days".
const HEALTH_HISTORY_EPOCH = "1970-01-01";

const bodyParams = computed(() => {
	const to = new Date();

	if (rangeDays.value === null) {
		return {
			from: HEALTH_HISTORY_EPOCH,
			to: to.toISOString().slice(0, 10),
		};
	}

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
				<div class="grid gap-3">
					<HealthRangeSwitcher v-model="rangeDays" />

					<div class="grid gap-6 lg:grid-cols-2 lg:items-start">
						<HealthWeightChart :points="bodyLog?.weightChart || []" />
						<HealthMeasurementsChart :points="bodyLog?.measurementChart || []" />
					</div>
				</div>

				<HealthBodyTable :entries="bodyLog?.entries || []" @delete="handleDelete" />
			</div>
		</CommonSuspenseWrapper>
	</section>
</template>
