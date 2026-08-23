<script setup lang="ts">
const props = defineProps<{
	title: string;
	items: IBudgetItem[];
	threshold: number;
	currency: string;
}>();

const emit = defineEmits(["remove"]);
</script>

<template>
	<section class="grid gap-3">
		<h2 class="text-sm uppercase tracking-wide text-gray-400">
			{{ props.title }}
		</h2>

		<p v-if="!props.items.length" class="text-sm text-gray-500">
			{{ $t("financePlanner.empty") }}
		</p>

		<PlannerItem
			v-for="item in props.items"
			:key="item.id"
			:item="item"
			:threshold="props.threshold"
			:currency="props.currency"
			@remove="emit('remove', $event)"
		/>
	</section>
</template>
