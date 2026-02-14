<script setup lang="ts">
const { locale, locales, setLocale } = useI18n();

const curLocale = computed(() =>
	locales.value?.find((l) => l.code === locale.value),
);

async function handleChange(val: string) {
	if (val) {
		await setLocale(val);
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
			<UIcon
				v-if="curLocale?.icon"
				:name="curLocale.icon"
				class="w-5 h-5"
			/>
		</template>
	</USelect>
</template>
