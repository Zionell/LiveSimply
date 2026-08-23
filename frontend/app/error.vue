<script setup lang="ts">
import type { NuxtError } from "#app";

enum EErrorType {
	notFound = "notFound",
	unauthorized = "unauthorized",
	forbidden = "forbidden",
	techError = "techError",
}

interface IErrorView {
	icon: string;
	image: string;
}

const props = defineProps({
	error: Object as () => NuxtError,
});

const statusMap: Record<number, EErrorType> = {
	401: EErrorType.unauthorized,
	403: EErrorType.forbidden,
	404: EErrorType.notFound,
};

const viewMap: Record<EErrorType, IErrorView> = {
	[EErrorType.notFound]: {
		icon: "i-lucide-arrow-left",
		image: "/images/error-404.svg",
	},
	[EErrorType.unauthorized]: {
		icon: "i-lucide-log-in",
		image: "/images/error-401.svg",
	},
	[EErrorType.forbidden]: {
		icon: "i-lucide-arrow-left",
		image: "/images/error-403.svg",
	},
	[EErrorType.techError]: {
		icon: "i-lucide-rotate-cw",
		image: "/images/error-500.svg",
	},
};

const code = computed(() => props.error?.statusCode || 500);

const status = computed(() => statusMap[code.value] || EErrorType.techError);

const view = computed(() => viewMap[status.value]);

function handleError() {
	if (status.value === EErrorType.techError) {
		window.location.reload();
	} else {
		clearError({ redirect: ERoutes.index });
	}
}
</script>

<template>
	<main class="flex items-center min-h-screen bg-black px-8 py-24 md:px-16 lg:px-24 lg:py-32">
		<NuxtLoadingIndicator color="#0278ae" />

		<div
			class="grid items-center gap-16 w-full max-w-7xl mx-auto lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-24"
		>
			<div class="flex flex-col items-start order-2 lg:order-1">
				<span class="text-2xl font-bold uppercase tracking-[0.4em] text-gray-500">
					{{ code }}
				</span>

				<h1 class="mt-4 text-5xl font-bold leading-tight md:text-7xl">
					{{ $t(`errorPage.${status}.title`) }}
				</h1>

				<p class="mt-5 max-w-md text-base leading-relaxed text-gray-400">
					{{ $t(`errorPage.${status}.text`) }}
				</p>

				<DevOnly>
					<div class="mt-4 max-w-md text-sm text-red-500" v-html="error?.message" />
				</DevOnly>

				<UButton
					class="mt-10"
					size="xl"
					color="primary"
					variant="outline"
					:icon="view.icon"
					@click="handleError"
				>
					{{ $t(`errorPage.${status}.btnText`) }}
				</UButton>
			</div>

			<div class="flex justify-center order-1 lg:order-2">
				<NuxtImg class="w-full max-w-2xl h-auto" :src="view.image" alt="" aria-hidden="true" />
			</div>
		</div>
	</main>
</template>
