<script setup lang="ts">
import { getImage } from "~/assets/utils/images";

const props = defineProps<{
	card: IBusinessCardDetail;
}>();

const link = computed(() => {
	return window?.location.href;
});

const filteredLinks = computed(() => {
	return props.card.socialLinks?.filter((s) => s.isVisible);
});

function dividePhrase(str: string) {
	const strToArr = str.split(" ");
	return `<span class="text-indigo-800">${strToArr[0]}</span>&nbsp;${strToArr[1]}`;
}
</script>

<template>
	<div
		class="overflow-auto lg:w-xl w-full lg:h-142.5 :lg-translate-x-3 rounded-r-lg bg-gray-900"
	>
		<div
			class="flex lg:px-7 md:px-5 lg:py-5 py-3 md:text-2xl text-lg font-extrabold"
			v-html="dividePhrase($t('businessCardView.about'))"
		/>

		<div class="lg:p-7 lg:px-7 px-5 lg:py-5 py-3">
			<div class="md:text-lg text-sm text-slate-400">
				{{ props.card.description }}
			</div>
		</div>

		<div
			class="flex lg:px-7 md:px-5 lg:py-5 py-3 md:text-2xl text-lg font-extrabold"
			v-html="dividePhrase($t('businessCardView.contactLinks'))"
		/>

		<div class="lg:p-7 lg:px-7 px-5 lg:py-5 py-3">
			<div class="grid gap-4">
				<ULink
					v-for="link in filteredLinks"
					:key="link.id"
					:to="link.link"
					target="_blank"
					class="flex items-center gap-2"
				>
					<UAvatar
						:text="link.name"
						:src="getImage(link) || '/images/seo.jpg'"
						size="lg"
					/>
					<div class="flex flex-col ml-3">
						<p class="text-md">{{ link.name }}</p>
					</div>
				</ULink>
			</div>
			<ClientOnly>
				<LazyCommonQrGen
					hydrate-on-visible
					class="sticky top-2"
					:link="link"
				/>
			</ClientOnly>
		</div>
	</div>
</template>
