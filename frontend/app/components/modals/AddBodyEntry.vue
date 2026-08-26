<script setup lang="ts">
import { z } from "zod";
import { api } from "~~/lib/api";
import { getError } from "~/assets/utils/common.ts";

const emit = defineEmits(["refresh"]);

const { t } = useI18n();
const toast = useToast();
const slideOverRef = useTemplateRef("slideOver");

const optionalNumber = z.number().nullable();

const schema = z.object({
	date: z.string().nonempty({ message: t("inputsErrors.required") }),
	weightKg: optionalNumber,
	chestCm: optionalNumber,
	waistCm: optionalNumber,
	armCm: optionalNumber,
	note: z.string().nullable(),
});

const today = new Date().toISOString().slice(0, 10);

const state = reactive({
	date: today,
	weightKg: null as number | null,
	chestCm: null as number | null,
	waistCm: null as number | null,
	armCm: null as number | null,
	note: null as string | null,
});

const isLoading = ref<boolean>(false);

// v-model.number falls back to the raw string when the field is cleared (Vue's
// looseToNumber returns the original value, not NaN or null, when parseFloat fails
// on an empty string). Route every numeric input through this normaliser so state
// can never hold "" or NaN — only a real number or null.
function toNullableNumber(value: unknown): number | null {
	if (value === null || value === undefined || value === "") {
		return null;
	}

	const num = typeof value === "number" ? value : Number(value);

	return Number.isNaN(num) ? null : num;
}

const weightKg = computed<number | null>({
	get: () => state.weightKg,
	set: (value) => {
		state.weightKg = toNullableNumber(value);
	},
});

const chestCm = computed<number | null>({
	get: () => state.chestCm,
	set: (value) => {
		state.chestCm = toNullableNumber(value);
	},
});

const waistCm = computed<number | null>({
	get: () => state.waistCm,
	set: (value) => {
		state.waistCm = toNullableNumber(value);
	},
});

const armCm = computed<number | null>({
	get: () => state.armCm,
	set: (value) => {
		state.armCm = toNullableNumber(value);
	},
});

const hasValue = computed((): boolean =>
	[state.weightKg, state.chestCm, state.waistCm, state.armCm].some(
		(value) => value !== null && value !== undefined && !Number.isNaN(value),
	),
);

const isValid = computed(() => schema.safeParse(state).success && hasValue.value);

async function onSubmit() {
	try {
		isLoading.value = true;

		const payload: Record<string, unknown> = { date: state.date };

		(["weightKg", "chestCm", "waistCm", "armCm"] as const).forEach((key) => {
			if (state[key] !== null && !Number.isNaN(state[key])) {
				payload[key] = state[key];
			}
		});

		if (state.note) {
			payload.note = state.note;
		}

		await $fetch(api.health.body, {
			method: "POST",
			body: JSON.stringify(payload),
		});

		emit("refresh");
		toast.add({
			title: t("common.added"),
			color: "success",
			icon: "i-lucide-circle-check",
		});
	} catch (e) {
		console.warn("AddBodyEntry / onSubmit: ", e);
		toast.add({ title: getError(e) || t("common.error"), color: "error" });
	} finally {
		isLoading.value = false;
		slideOverRef.value?.handleClose();
	}
}

function handleClose() {
	state.date = today;
	state.weightKg = null;
	state.chestCm = null;
	state.waistCm = null;
	state.armCm = null;
	state.note = null;
}
</script>

<template>
	<ModalsBaseSlideOver
		ref="slideOver"
		btnLabel="newBodyEntry"
		btnIcon="i-lucide-plus"
		title="newBodyEntry"
		:isDisabled="!isValid"
		:isLoading="isLoading"
		@close="handleClose"
		@click="onSubmit"
	>
		<UForm :schema="schema" :state="state" class="w-full flex flex-col space-y-4" @submit="onSubmit">
			<UFormField class="w-full" :label="$t('health.date')" name="date">
				<UInput v-model="state.date" type="date" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.weight')" name="weightKg">
				<UInput v-model.number="weightKg" type="number" step="0.1" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.chest')" name="chestCm">
				<UInput v-model.number="chestCm" type="number" step="0.5" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.waist')" name="waistCm">
				<UInput v-model.number="waistCm" type="number" step="0.5" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.arm')" name="armCm">
				<UInput v-model.number="armCm" type="number" step="0.5" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.note')" name="note">
				<UTextarea v-model="state.note" class="w-full" size="md" />
			</UFormField>

			<p v-if="!hasValue" class="text-xs text-amber-500">{{ $t("health.needValue") }}</p>
		</UForm>
	</ModalsBaseSlideOver>
</template>
