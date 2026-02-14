<script setup>
import * as locales from "@nuxt/ui/locale";

const { locale } = useI18n();
const head = useLocaleHead({
	addDirAttribute: true,
	identifierAttribute: "id",
	addSeoAttributes: true,
});
const { t } = useI18n();
const lang = computed(() => locales[locale.value].code);
const dir = computed(() => locales[locale.value].dir);

useHead({
	htmlAttrs: {
		lang,
		dir,
	},
	title: t(`title`),
	link: [...(head.value.link || [])],
	meta: [...(head.value.meta || [])],
});
</script>

<template>
	<UApp :locale="locales[locale]">
		<NuxtLayout>
			<NuxtPage />
		</NuxtLayout>
	</UApp>
</template>
