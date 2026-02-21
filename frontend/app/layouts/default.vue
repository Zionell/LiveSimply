<script setup></script>

<template>
	<main class="grid lg:grid-cols-[18rem_1fr] lg:grid-rows-[4rem_1fr]">
		<NuxtLoadingIndicator color="#0278ae" />

		<LayoutNavBar />

		<LayoutTheHeader />

		<div class="w-full min-h-full lg:row-start-2 lg:col-start-2 lg:p-8 p-4">
			<slot />
		</div>

		<CommonReviewForm />
		<ModalsAddTotal />
	</main>
</template>
