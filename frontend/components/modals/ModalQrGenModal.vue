<script setup lang="ts">
import { capture } from "@/assets/utils/common.ts";

const props = defineProps<{
	link: string;
}>();

const isOpen = ref<boolean>(false);

function handleDownload() {
	capture("qrCode");
}
</script>

<template>
	<UModal
		v-model:open="isOpen"
		:title="$t(`modals.generateQr`)"
		:description="$t(`modals.generateQrDesc`)"
	>
		<UButton>
			{{ $t("buttons.qrGen") }}
		</UButton>

		<template #body>
			<QrGen id="qrCode" :link="props.link" />
		</template>

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
					:label="$t('buttons.download')"
					@click="handleDownload"
				/>
			</div>
		</template>
	</UModal>
</template>
