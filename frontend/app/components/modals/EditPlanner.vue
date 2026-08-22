<script setup lang="ts">
import { z } from "zod";
import { api } from "~~/lib/api";

const props = defineProps<{
	planner: IPlanner;
}>();

const emit = defineEmits(["refresh"]);

const { t } = useI18n();

const schema = z.object({
	curIncome: z.number({ error: t("inputsErrors.required") }).min(0, { message: t("inputsErrors.min", { min: 0 }) }),
	currencyFromId: z.string({ error: t("inputsErrors.required") }).nonempty({ message: t("inputsErrors.required") }),
	alertThreshold: z.number().min(1).max(100),
	isRegular: z.boolean(),
});

const state = reactive({
	curIncome: props.planner.expectedIncome.cur,
	currencyFromId: props.planner.expectedIncome.currency,
	alertThreshold: Math.round(props.planner.alertThreshold * 100),
	isRegular: props.planner.isRegular,
});

const isLoading = ref<boolean>(false);
const toast = useToast();
const slideOverRef = useTemplateRef("slideOver");

const { data, error } = await useFetch<FinanceSpecs>(api.finance.specs, {
	key: "FinanceSpecs",
});

if (error.value) {
	throw createError({
		statusCode: error.value?.statusCode,
		statusMessage: error.value?.statusMessage,
	});
}

const isValid = computed(() => schema.safeParse(state).success);

async function onSubmit() {
	try {
		isLoading.value = true;

		await $fetch(api.planner.detail(props.planner.id), {
			method: "PATCH",
			body: JSON.stringify({
				curIncome: state.curIncome,
				currencyFromId: state.currencyFromId,
				alertThreshold: state.alertThreshold / 100,
				isRegular: state.isRegular,
			}),
		});

		emit("refresh");
		toast.add({
			title: t("common.updated"),
			color: "success",
			icon: "i-lucide-circle-check",
		});
	} catch (e) {
		console.warn("onSubmit: ", e);
		toast.add({
			title: e?.data?.message?.[0] || e?.data?.message || t("common.error"),
			color: "error",
		});
	} finally {
		isLoading.value = false;
		slideOverRef.value?.handleClose();
	}
}

function handleClose() {
	state.curIncome = props.planner.expectedIncome.cur;
	state.currencyFromId = props.planner.expectedIncome.currency;
	state.alertThreshold = Math.round(props.planner.alertThreshold * 100);
	state.isRegular = props.planner.isRegular;
}
</script>

<template>
	<ModalsBaseSlideOver
		ref="slideOver"
		btnLabel="plannerSettings"
		btnIcon="i-lucide-settings-2"
		btnVariant="subtle"
		title="editPlanner"
		:isDisabled="!isValid"
		:isLoading="isLoading"
		@close="handleClose"
		@click="onSubmit"
	>
		<UForm :schema="schema" :state="state" class="w-full flex flex-col items-center space-y-4" @submit="onSubmit">
			<UFormField class="w-full" :label="$t('financePlanner.expectedIncome')" name="curIncome">
				<UInput type="number" class="w-full" size="md" placeholder="5 000" v-model="state.curIncome" />
			</UFormField>

			<UFormField class="w-full" :label="$t('inputs.exchange')" name="currencyFromId">
				<USelectMenu
					class="w-full"
					size="md"
					v-model="state.currencyFromId"
					:items="data?.exchange"
					placeholder="EUR"
					value-key="value"
					virtualize
				/>
			</UFormField>

			<UFormField
				class="w-full"
				:label="`${$t('financePlanner.threshold')}: ${state.alertThreshold}%`"
				:hint="$t('financePlanner.thresholdHint')"
				name="alertThreshold"
			>
				<USlider v-model="state.alertThreshold" :min="1" :max="100" :step="1" />
			</UFormField>

			<UFormField class="w-full" :label="$t('financePlanner.isRegular')" name="isRegular">
				<USwitch v-model="state.isRegular" />
			</UFormField>
		</UForm>
	</ModalsBaseSlideOver>
</template>
