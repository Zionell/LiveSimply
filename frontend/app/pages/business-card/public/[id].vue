<script setup lang="ts">
import { api } from "~~/lib/api";

definePageMeta({
	layout: "empty",
});

const { t } = useI18n();
const route = useRoute();

const id = computed(() => route.params.id);

const { data: card, error } = await useFetch<IBusinessCardDetail>(
	`${api.businessCard.common}${id.value}/`,
);

if (error.value) {
	throw createError({
		statusCode: error.value?.statusCode,
		statusMessage: error.value?.statusMessage,
	});
}

useSeoMeta({
	title: `${t("businessCardMeta.title")}${card.value?.user.name}`,
	ogTitle: `${t("businessCardMeta.title")}${card.value?.user.name}`,
	description: t("businessCardMeta.description"),
	ogDescription: t("businessCardMeta.description"),
	ogImage: "/images/seo.jpg",
	twitterCard: "summary_large_image",
});
</script>

<template>
	<section
		class="flex items-center justify-center lg:gap-0 md:gap-4 gap-2 lg:flex-row flex-col w-full h-full"
	>
		<BusinessCardViewHero v-if="card" :card="card" />
		<BusinessCardViewInner v-if="card" :card="card" />
	</section>
</template>
