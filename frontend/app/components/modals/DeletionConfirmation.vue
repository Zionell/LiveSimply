<script setup lang="ts">
const props = defineProps<{
	isLoading: boolean;
}>();

const emit = defineEmits(["submit"]);

const isOpen = ref<boolean>(false);

function handleSubmit(): void {
	emit("submit");
	isOpen.value = false;
}
</script>

<template>
	<UModal
		v-model:open="isOpen"
		:title="$t(`modalDeletionConfirmation.title`)"
		:description="$t(`modalDeletionConfirmation.text`)"
	>
		<UButton :loading="isLoading" color="error">
			{{ $t("buttons.delete") }}
		</UButton>

		<template #footer>
			<div class="grid grid-cols-2 gap-4 w-full">
				<UButton
					block
					color="error"
					:label="$t('buttons.close')"
					@click="isOpen = false"
				/>
				<UButton
					block
					:leading="props.isLoading"
					:label="$t('buttons.submit')"
					@click="handleSubmit"
				/>
			</div>
		</template>
	</UModal>
</template>
