<script setup lang="ts">
import { z } from "zod";
import { api } from "~~/lib/api";
import { getError } from "~/assets/utils/common.ts";

const props = defineProps<{
	profile: THealthProfileResponse | null;
}>();

const emit = defineEmits(["refresh"]);

const { t } = useI18n();
const toast = useToast();
const slideOverRef = useTemplateRef("slideOver");

const isExisting = computed((): boolean => Boolean(props.profile?.isConfigured));

const schema = z.object({
	sex: z.enum([EHealthSex.Male, EHealthSex.Female]),
	birthDate: z.string().nonempty({ message: t("inputsErrors.required") }),
	heightCm: z.number().min(50).max(260),
	activityLevel: z.enum([
		EActivityLevel.Sedentary,
		EActivityLevel.Light,
		EActivityLevel.Moderate,
		EActivityLevel.High,
	]),
	startWeightKg: z.number().min(20).max(500),
	targetWeightKg: z.number().min(20).max(500),
	startedAt: z.string().nonempty({ message: t("inputsErrors.required") }),
	dailyDeficit: z.number().int().min(0).max(1500),
	proteinPerKg: z.number().min(0.5).max(4),
	proteinBasis: z.enum([EProteinBasis.Current, EProteinBasis.Target]),
	fatPercent: z.number().min(15).max(60),
});

const today = new Date().toISOString().slice(0, 10);

function initialState() {
	const profile = props.profile?.isConfigured ? props.profile : null;

	return {
		sex: profile?.sex ?? EHealthSex.Male,
		birthDate: profile?.birthDate ?? "",
		heightCm: profile?.heightCm ?? 170,
		activityLevel: profile?.activityLevel ?? EActivityLevel.Light,
		startWeightKg: profile?.startWeightKg ?? 75,
		targetWeightKg: profile?.targetWeightKg ?? 70,
		startedAt: profile?.startedAt ?? today,
		dailyDeficit: profile?.dailyDeficit ?? 500,
		proteinPerKg: profile?.proteinPerKg ?? 1.8,
		proteinBasis: profile?.proteinBasis ?? EProteinBasis.Current,
		fatPercent: Math.round((profile?.fatPercent ?? 0.3) * 100),
	};
}

const state = reactive(initialState());
const isLoading = ref<boolean>(false);

// `state` is only seeded once via reactive(initialState()). A save's
// handleClose() resets it synchronously in onSubmit's `finally`, before
// refreshAll()'s round trip resolves, so it reads the pre-save profile.
// Resyncing here whenever the prop itself changes (i.e. once the refresh
// actually lands) prevents a stale field from riding along on the next save.
watch(
	() => props.profile,
	() => {
		Object.assign(state, initialState());
	},
);

const sexItems = computed(() => [
	{ label: t("health.male"), value: EHealthSex.Male },
	{ label: t("health.female"), value: EHealthSex.Female },
]);

const activityItems = computed(() =>
	Object.values(EActivityLevel).map((value) => ({
		label: t(`health.activityLevels.${value}`),
		value,
	})),
);

const basisItems = computed(() => [
	{ label: t("health.basisCurrent"), value: EProteinBasis.Current },
	{ label: t("health.basisTarget"), value: EProteinBasis.Target },
]);

const isValid = computed(() => schema.safeParse(state).success);

async function onSubmit() {
	try {
		isLoading.value = true;

		await $fetch(api.health.profile, {
			method: isExisting.value ? "PATCH" : "POST",
			body: JSON.stringify({
				...state,
				fatPercent: state.fatPercent / 100,
			}),
		});

		emit("refresh");
		toast.add({
			title: isExisting.value ? t("common.updated") : t("common.added"),
			color: "success",
			icon: "i-lucide-circle-check",
		});
	} catch (e) {
		console.warn("EditHealthProfile / onSubmit: ", e);
		toast.add({ title: getError(e) || t("common.error"), color: "error" });
	} finally {
		isLoading.value = false;
		slideOverRef.value?.handleClose();
	}
}

function handleClose() {
	Object.assign(state, initialState());
}
</script>

<template>
	<ModalsBaseSlideOver
		ref="slideOver"
		:btnLabel="isExisting ? 'healthProfile' : 'fillProfile'"
		btnIcon="i-lucide-settings-2"
		btnVariant="subtle"
		title="healthProfile"
		:isDisabled="!isValid"
		:isLoading="isLoading"
		@close="handleClose"
		@click="onSubmit"
	>
		<UForm :schema="schema" :state="state" class="w-full flex flex-col space-y-4" @submit="onSubmit">
			<UFormField class="w-full" :label="$t('health.sex')" name="sex">
				<URadioGroup v-model="state.sex" :items="sexItems" orientation="horizontal" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.birthDate')" name="birthDate">
				<UInput v-model="state.birthDate" type="date" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.height')" name="heightCm">
				<UInput v-model.number="state.heightCm" type="number" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.startWeight')" name="startWeightKg">
				<UInput v-model.number="state.startWeightKg" type="number" step="0.1" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.targetWeight')" name="targetWeightKg">
				<UInput v-model.number="state.targetWeightKg" type="number" step="0.1" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.startedAt')" name="startedAt">
				<UInput v-model="state.startedAt" type="date" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.activity')" name="activityLevel">
				<USelect v-model="state.activityLevel" :items="activityItems" value-key="value" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.deficit')" name="dailyDeficit">
				<UInput v-model.number="state.dailyDeficit" type="number" step="50" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.proteinPerKg')" name="proteinPerKg">
				<UInput v-model.number="state.proteinPerKg" type="number" step="0.1" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.proteinBasis')" name="proteinBasis">
				<USelect v-model="state.proteinBasis" :items="basisItems" value-key="value" class="w-full" size="md" />
			</UFormField>

			<UFormField
				class="w-full"
				:label="`${$t('health.fatPercent')}: ${state.fatPercent}%`"
				name="fatPercent"
			>
				<USlider v-model="state.fatPercent" :min="15" :max="60" :step="1" />
			</UFormField>
		</UForm>
	</ModalsBaseSlideOver>
</template>
