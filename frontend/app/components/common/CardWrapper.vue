<script setup lang="ts"></script>

<template>
	<UCard
		:ui="{
			root: 'flex flex-col overflow-hidden',
			header: 'px-4 py-2 lg:px-6 lg:py-4',
			body: 'grow px-4 py-2 lg:px-6 lg:py-4',
		}"
	>
		<template v-if="$slots.header?.()" #header>
			<h4 class="lg:text-2xl text-xl font-bold">
				<slot name="header" />
			</h4>
		</template>

		<slot />
	</UCard>
</template>
