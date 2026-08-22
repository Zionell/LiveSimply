<script setup lang="ts">
const props = defineProps<{
	title: string;
	description: string;
	confirmTitle: string;
	confirmText: string;
	buttonLabel: string;
	isLoading?: boolean;
}>();

const emit = defineEmits(["confirm"]);

const isOpen = ref<boolean>(false);

function handleConfirm(): void {
	emit("confirm");
	isOpen.value = false;
}
</script>

<template>
	<CommonCardWrapper>
		<template #header>{{ props.title }}</template>

		<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
			<p class="text-sm text-gray-400">{{ props.description }}</p>

			<UModal v-model:open="isOpen" :title="props.confirmTitle" :description="props.confirmText">
				<UButton color="error" variant="subtle" class="shrink-0" :loading="props.isLoading">
					{{ props.buttonLabel }}
				</UButton>

				<template #footer>
					<div class="grid grid-cols-2 gap-4 w-full">
						<UButton block variant="subtle" :label="$t('buttons.close')" @click="isOpen = false" />
						<UButton block color="error" :label="$t('buttons.submit')" @click="handleConfirm" />
					</div>
				</template>
			</UModal>
		</div>
	</CommonCardWrapper>
</template>
