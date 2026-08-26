<script setup lang="ts">
import { api } from "~~/lib/api";

const { data: profile, error, refresh: refreshProfile } = await useFetch<THealthProfileResponse>(
	api.health.profile,
	{ key: "HealthProfile" },
);

if (error.value) {
	throw createError({
		statusCode: error.value?.statusCode,
		statusMessage: error.value?.statusMessage,
	});
}

const isConfigured = computed((): boolean => Boolean(profile.value?.isConfigured));
</script>

<template>
	<section class="grid gap-4">
		<h1 class="lg:text-3xl text-2xl font-bold">{{ $t("routes.health") }}</h1>

		<HealthTabs />

		<CommonSectionHeader>
			<ModalsEditHealthProfile :profile="profile ?? null" @refresh="refreshProfile" />
		</CommonSectionHeader>

		<CommonSuspenseWrapper>
			<HealthEmptyProfile v-if="!isConfigured" />

			<div v-else-if="profile?.isConfigured" class="grid gap-6">
				<HealthSummary :profile="profile" />
				<HealthNormCard :profile="profile" />
			</div>
		</CommonSuspenseWrapper>
	</section>
</template>
