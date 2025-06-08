<script setup lang="ts">
interface Props {
	loading?: boolean;
	emptyMessage?: string;
}

const props = withDefaults(defineProps<Props>(), {
	loading: false,
	emptyMessage: "common.empty",
});

const slots = useSlots();
const hasRenderedSlot = computed(() => {
	if (!slots.default) return false;
	const content = slots.default();
	return content.some(
		(node) =>
			typeof node.type === "string" || typeof node.type === "object",
	);
});
</script>

<template>
	<div class="w-full h-full">
		<div
			v-if="loading"
			class="flex items-center justify-center w-full h-full min-h-50"
		>
			<div
				class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"
			></div>
		</div>
		<div v-else-if="hasRenderedSlot">
			<slot />
		</div>
		<div
			v-else
			class="flex items-center justify-center w-full h-full min-h-50 text-center text-2xl text-gray-500"
		>
			{{ $t(props.emptyMessage) }}
		</div>
	</div>
</template>
