<script setup lang="ts">
import { z } from "zod";
import { api } from "~~/lib/api";

const props = defineProps<{
	plannerId: string;
	usedCategories: string[];
}>();

const emit = defineEmits(["refresh"]);

interface IState {
	label: string;
	curAmount: number | null;
	currencyFromId: string;
	expenseCategoryId: string;
	isRequired: boolean;
}

const initialValues: IState = {
	label: "",
	curAmount: null,
	currencyFromId: "",
	expenseCategoryId: "",
	isRequired: false,
};

const { t } = useI18n();

const schema = z.object({
	label: z.string({ error: t("inputsErrors.required") }).nonempty({ message: t("inputsErrors.required") }),
	curAmount: z.number({ error: t("inputsErrors.required") }).min(0, { message: t("inputsErrors.min", { min: 0 }) }),
	currencyFromId: z.string({ error: t("inputsErrors.required") }).nonempty({ message: t("inputsErrors.required") }),
	expenseCategoryId: z
		.string({ error: t("inputsErrors.required") })
		.nonempty({ message: t("inputsErrors.required") }),
	isRequired: z.boolean(),
});

const state = reactive<IState>({ ...initialValues });
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

const availableCategories = computed(() =>
	(data.value?.expenseCategory || []).filter((c) => !props.usedCategories.includes(c.value)),
);

const isValid = computed(() => schema.safeParse(state).success);

async function onSubmit() {
	try {
		isLoading.value = true;

		await $fetch(api.planner.items(props.plannerId), {
			method: "POST",
			body: JSON.stringify(state),
		});

		emit("refresh");
		toast.add({
			title: t("common.added"),
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
	Object.assign(state, initialValues);
}
</script>

<template>
	<ModalsBaseSlideOver
		ref="slideOver"
		btnLabel="new"
		title="newBudgetItem"
		:isDisabled="!isValid"
		:isLoading="isLoading"
		@close="handleClose"
		@click="onSubmit"
	>
		<UForm :schema="schema" :state="state" class="w-full flex flex-col items-center space-y-4" @submit="onSubmit">
			<UFormField class="w-full" :label="$t('inputs.budgetItemLabel')" name="label">
				<UInput class="w-full" size="md" :placeholder="$t('inputs.budgetItemLabel')" v-model="state.label" />
			</UFormField>

			<UFormField class="w-full" :label="$t('inputs.expenseCategory')" name="expenseCategoryId">
				<USelectMenu
					class="w-full"
					size="md"
					v-model="state.expenseCategoryId"
					:items="availableCategories"
					value-key="value"
					virtualize
				/>
			</UFormField>

			<UFormField class="w-full" :label="$t('inputs.budgetItemAmount')" name="curAmount">
				<UInput type="number" class="w-full" size="md" placeholder="1 000" v-model="state.curAmount" />
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

			<UFormField class="w-full" :label="$t('inputs.isRequired')" name="isRequired">
				<USwitch v-model="state.isRequired" />
			</UFormField>
		</UForm>
	</ModalsBaseSlideOver>
</template>
