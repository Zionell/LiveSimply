<script setup lang="ts">
import { copyLink } from "~/assets/utils/common";

const props = defineProps<{
	card: IBusinessCard | null;
}>();

const { t } = useI18n();
const isCopied = ref<boolean>(false);

const tooltipText = computed(() => {
	return t(`businessCardLink.${isCopied.value ? "isCopied" : "tooltip"}`);
});

const link = computed(() => {
	const host = window?.location?.origin;
	return `${host}/business-card/public/${props.card?.id}`;
});

function copyGeneratedLink() {
	copyLink(link.value);
	isCopied.value = true;
	setTimeout(() => (isCopied.value = false), 1000);
}
</script>

<template>
	<div class="flex gap-4">
		<ModalsQrGenModal :link="link" />

		<UTooltip :text="tooltipText">
			<UButton
				:label="$t(`businessCardLink.generateLink`)"
				@click="copyGeneratedLink"
			/>
		</UTooltip>
	</div>
</template>
