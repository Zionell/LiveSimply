<script setup lang="ts">
import type { NuxtError } from "nuxt/app";

enum EErrorType {
	notFound = "notFound",
	techError = "techError",
}

const props = defineProps({
	error: Object as () => NuxtError,
});

const status = computed(() =>
	props.error?.statusCode === 404
		? EErrorType.notFound
		: EErrorType.techError,
);

function handleError() {
	if (status.value === EErrorType.notFound) {
		clearError({ redirect: "/" });
	} else {
		window.location.reload();
	}
}
</script>

<template>
	<section
		class="flex flex-col items-center justify-center w-full h-screen text-center"
	>
		<h1 class="md:p-8 p-4 lg:text-9xl md:text-6xl text-4xl font-bold">
			{{ $t(`errorPage.${status}.title`) }}
		</h1>
		<h2 class="md:text-3xl text-xl text-gray-500">
			{{ $t(`errorPage.${status}.text`) }}
		</h2>

		<DevOnly>
			<div v-html="error?.message" />
		</DevOnly>

		<UButton class="mt-8" size="lg" @click="handleError">
			{{ $t(`errorPage.${status}.btnText`) }}
		</UButton>
	</section>
</template>
