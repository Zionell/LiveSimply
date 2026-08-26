<script setup lang="ts">
import { splitThousands } from "~/assets/utils/numbers";

const props = defineProps<{
	profile: IHealthProfile;
}>();

const norms = computed(() => [
	{ label: "health.bmr", value: `${splitThousands(props.profile.bmr)}` },
	{ label: "health.tdee", value: `${splitThousands(props.profile.tdee)}` },
	{ label: "health.deficit", value: `${splitThousands(props.profile.dailyDeficit)}` },
	{ label: "health.targetKcal", value: `${splitThousands(props.profile.targetKcal)}` },
]);

const macros = computed(() => [
	{ label: "health.protein", value: props.profile.macroTargets.proteinG },
	{ label: "health.fat", value: props.profile.macroTargets.fatG },
	{ label: "health.carbs", value: props.profile.macroTargets.carbsG },
]);
</script>

<template>
	<CommonCardWrapper>
		<template #header>{{ $t("health.targetKcal") }}</template>

		<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
			<div v-for="norm in norms" :key="norm.label">
				<div class="text-xs text-gray-400">{{ $t(norm.label) }}</div>
				<div class="text-lg">{{ norm.value }}</div>
			</div>
		</div>

		<div class="mt-4 grid grid-cols-3 gap-4">
			<div v-for="macro in macros" :key="macro.label">
				<div class="text-xs text-gray-400">{{ $t(macro.label) }}</div>
				<div class="text-lg">{{ macro.value }} {{ $t("health.gram") }}</div>
			</div>
		</div>

		<UAlert
			v-if="props.profile.isMacroConflict"
			class="mt-4"
			color="warning"
			variant="subtle"
			icon="i-lucide-triangle-alert"
			:description="$t('health.macroConflict')"
		/>
	</CommonCardWrapper>
</template>
