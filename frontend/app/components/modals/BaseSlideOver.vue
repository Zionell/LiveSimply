<script setup lang="ts">
import type { ButtonProps } from "@nuxt/ui";

interface IProps {
	btnLabel: string;
	btnIcon?: string;
	btnVariant?: ButtonProps["variant"];
	footerBtnLabel?: string;
	title: string;
	description?: string;
	isDisabled?: boolean;
	isLoading?: boolean;
}

const props = withDefaults(defineProps<IProps>(), {
	footerBtnLabel: "save",
	description: "",
	isDisabled: false,
});

const emit = defineEmits(["click", "close"]);

const isOpen = ref<boolean>(false);

defineExpose({
	isOpen,
	handleClose,
});

function handleClose(): void {
	isOpen.value = false;
	emit("close");
}
</script>

<template>
	<USlideover
		v-model:open="isOpen"
		:title="$t(`modals.${props.title}`)"
		:description="props.description || $t(`modals.${props.title}`)"
		@after:leave="emit('close')"
	>
		<UButton :icon="props.btnIcon" :variant="props.btnVariant" @click="isOpen = true">
			{{ $t(`buttons.${props.btnLabel}`) }}
		</UButton>

		<template #body>
			<slot />
		</template>

		<template #footer>
			<div class="grid grid-cols-2 gap-4 w-full">
				<UButton block color="error" :label="$t('buttons.close')" @click="handleClose" />
				<UButton
					:disabled="props.isDisabled"
					:loading="props.isLoading"
					block
					:label="$t(`buttons.${props.footerBtnLabel}`)"
					@click="emit('click')"
				/>
			</div>
		</template>
	</USlideover>
</template>
