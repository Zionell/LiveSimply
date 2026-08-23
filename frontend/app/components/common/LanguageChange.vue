<script setup lang="ts">
const { locale, locales, setLocale } = useI18n();
const userStore = useUserStore();

const curLocale = computed(() => locales.value?.find((l) => l.code === locale.value));

async function persistLanguage(language: string) {
	if (!userStore.user || userStore.user.language === language) {
		return;
	}

	try {
		await userStore.updateUser({ language });
	} catch (e) {
		// The UI language has already switched; failing to remember it only
		// affects which language future emails are written in.
		console.warn("LanguageChange / persistLanguage: ", e);
	}
}

async function handleChange(val: "en" | "ru") {
	if (val) {
		await setLocale(val);
		await persistLanguage(val);
		await refreshNuxtData();
	}
}
</script>

<template>
	<USelect
		size="xl"
		:items="locales"
		valueKey="code"
		labelKey="name"
		:defaultValue="curLocale?.code"
		@update:modelValue="handleChange"
	>
		<template #leading>
			<UIcon v-if="curLocale?.icon" :name="curLocale.icon" class="w-5 h-5" />
		</template>
	</USelect>
</template>
