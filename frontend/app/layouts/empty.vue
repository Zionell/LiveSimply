<script setup></script>

<template>
	<main
		class="flex flex-col items-center justify-between bg-gray-900 min-h-screen p-4"
	>
		<ULink to="/">
			<CommonLogoIcon class="h-5" />
		</ULink>

		<div
			class="flex items-center justify-center xl:bg-black rounded-3xl grow h-full xl:w-[90%] w-full xl:m-8 m-4"
		>
			<slot />
		</div>
	</main>
</template>
