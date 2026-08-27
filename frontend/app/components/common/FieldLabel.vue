<script setup lang="ts">
const props = defineProps<{
	label: string;
	hint?: string;
}>();
</script>

<template>
	<span class="inline-flex items-center gap-1.5">
		{{ props.label }}

		<UTooltip
			v-if="props.hint"
			:text="props.hint"
			:delay-duration="150"
			:ui="{ content: 'h-auto max-w-72 whitespace-normal', text: 'whitespace-normal' }"
		>
			<UIcon
				name="i-lucide-info"
				class="size-4 shrink-0 text-gray-400 cursor-help"
				tabindex="0"
			/>
		</UTooltip>
	</span>
</template>
