<script setup lang="ts">
import {
	type GradientType,
	type ImageSettings,
	type Level,
	QrcodeSvg,
	type RenderAs,
} from "qrcode.vue";

const props = defineProps<{
	link: string;
}>();

const level = ref<Level>("M");
const renderAs = ref<RenderAs>("canvas");
const margin = ref<number>(1);
const size = ref<number>(200);
const imageSettings = ref<ImageSettings>({
	src: "/images/qrCodeLogo.png",
	width: 50,
	height: 50,
	excavate: true,
});

const gradient = ref<boolean>(true);
const gradientType = ref<GradientType>("linear");
const gradientStartColor = ref("#101828");
const gradientEndColor = ref("#00bcff");
</script>

<template>
	<div
		class="bg-gray-900 flex flex-col mx-auto items-center gap-4 w-fit p-4 rounded-xl overflow-hidden"
	>
		<QrcodeSvg
			:value="props.link"
			:level="level"
			:render-as="renderAs"
			:margin="margin"
			:size="size"
			:image-settings="imageSettings"
			:gradient="gradient"
			:gradient-type="gradientType"
			:gradient-start-color="gradientStartColor"
			:gradient-end-color="gradientEndColor"
		/>

		<CommonLogoIcon class="h-6" />
	</div>
</template>
