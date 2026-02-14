<script setup lang="ts">
import { api } from "~~/lib/api";

const { data, error } = await useFetch<Record<string, string>[]>(
	api.users.common,
);

if (error.value) {
	throw createError({
		statusCode: error.value?.statusCode,
		statusMessage: error.value?.statusMessage,
	});
}
</script>

<template>
	<CommonSuspenseWrapper>
		<div v-if="data?.length">
			<UTable :data="data" />
		</div>
	</CommonSuspenseWrapper>
</template>
