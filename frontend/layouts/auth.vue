<script setup></script>

<template>
	<main class="grid lg:grid-cols-[60%_40%] min-h-screen bg-gray-900">
		<NuxtLoadingIndicator color="#111827" />

		<div class="hidden lg:flex rounded-r-3xl overflow-hidden">
			<NuxtImg
				src="images/login-bg.jpg"
				alt="Image"
				class="object-cover h-screen w-full"
				placeholder
			/>
		</div>

		<slot />
	</main>
</template>
