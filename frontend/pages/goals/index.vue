<script setup lang="ts">
import type { IGoal } from "@/types/goals.ts";
import { api } from "@/lib/api.ts";

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
		<SectionHeader classs="lg:p-0 px-4 lg:flex-row flex-col">
			<ModalAddNewGoal @refresh="refresh" />
		</SectionHeader>

		<SuspenseWrapper>
			<GoalsBody
				v-if="data?.length"
				:goals="data"
				:loading="pending"
				@refresh="refresh"
			/>
		</SuspenseWrapper>
	</section>
</template>
