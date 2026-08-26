<script setup lang="ts"></script>

<template>
	<CommonCardWrapper>
		<div class="flex flex-col items-center gap-4 py-8 text-center">
			<UIcon name="i-lucide-heart-pulse" class="size-10 text-gray-400" />

			<p class="max-w-md text-gray-400">{{ $t("health.emptyProfile") }}</p>

			<slot />
		</div>
	</CommonCardWrapper>
</template>
