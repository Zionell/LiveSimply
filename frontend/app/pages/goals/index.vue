<script setup lang="ts">
import { api } from "~~/lib/api";

const { data, error, pending, refresh } = await useFetch<IGoal[]>(
	api.goals.common,
);

if (error.value) {
	throw createError({
		statusCode: error.value?.statusCode,
		statusMessage: error.value?.statusMessage,
	});
}
</script>

<template>
	<section class="overflow-hidden grid gap-4">
		<CommonSectionHeader classs="lg:p-0 px-4 lg:flex-row flex-col">
			<ModalsAddNewGoal @refresh="refresh" />
		</CommonSectionHeader>

		<CommonSuspenseWrapper>
			<GoalsBody
				v-if="data?.length"
				:goals="data"
				:loading="pending"
				@refresh="refresh"
			/>
		</CommonSuspenseWrapper>
	</section>
</template>
