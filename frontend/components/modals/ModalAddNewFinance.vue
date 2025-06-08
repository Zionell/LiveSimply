<script setup lang="ts">
import { z } from "zod";
import { EOperationTypes, type FinanceSpecs } from "@/types/finance.ts";
import { api } from "@/lib/api.ts";

const emit = defineEmits(["refresh"]);

const initialValues = {
	curPrice: null,
	currencyFromId: "",
	operationCategoryId: "",
	expenseCategoryId: "",
	goalsId: "",
};
const { t } = useI18n();

const schema = z.object({
	curPrice: z.number({ required_error: t("inputsErrors.required") }),
	currencyFromId: z
		.string({ required_error: t("inputsErrors.required") })
		.nonempty(),
	operationCategoryId: z
		.string({
			required_error: t("inputsErrors.required"),
		})
		.nonempty(),
	expenseCategoryId: z.string().optional(),
	goalsId: z.string().optional(),
});

const state = reactive({ ...initialValues });
const isLoading = ref<boolean>(false);
const toast = useToast();
const sliderOverRef = useTemplateRef("slideOver");

const { data, error } = await useFetch<FinanceSpecs>(api.finance.specs, {
	key: "FinanceSpecs",
});

if (error.value) {
	throw createError({
		statusCode: error.value?.statusCode,
		statusMessage: error.value?.statusMessage,
	});
}

const isExpenseCatVisible = computed(
	(): boolean => state.operationCategoryId === EOperationTypes.expense,
);

const isGoalsVisible = computed(
	(): boolean => state.operationCategoryId === EOperationTypes.goals,
);

const isValid = computed(() => {
	return schema.safeParse(state).success;
});

async function onSubmit() {
	try {
		isLoading.value = true;

		await $fetch(api.finance.common, {
			method: "POST",
			body: JSON.stringify(state),
		});

		sliderOverRef.value?.handleClose();
		emit("refresh");
		toast.add({
			title: t("common.added"),
			color: "success",
			icon: "i-lucide-circle-check",
		});

		await useUserStore().fetchUser();
	} catch (e) {
		console.warn("onSubmit: ", e);
		toast.add({
			title: e?.data?.message || t("common.error"),
			color: "error",
		});
	} finally {
		isLoading.value = false;
		sliderOverRef.value?.handleClose();
	}
}

function handleCLose() {
	Object.entries(initialValues).forEach(([key, value]) => {
		state[key] = value;
	});
}
</script>

<template>
	<BaseSlideOver
		ref="slideOver"
		btnLabel="new"
		title="newFinance"
		:isDisabled="!isValid"
		@close="handleCLose"
		@click="onSubmit"
	>
		<UForm
			:schema="schema"
			:state="state"
			class="w-full flex flex-col items-center space-y-4"
			@submit="onSubmit"
		>
			<UFormField
				class="w-full"
				:label="$t('inputs.curPrice')"
				name="curPrice"
			>
				<UInput
					type="number"
					class="w-full"
					size="md"
					placeholder="12 093"
					v-model="state.curPrice"
				/>
			</UFormField>

			<UFormField
				class="w-full"
				:label="$t('inputs.currencyFrom')"
				name="currencyFromId"
			>
				<USelect
					class="w-full"
					size="md"
					v-model="state.currencyFromId"
					:items="data?.exchange"
					placeholder="RUB"
				/>
			</UFormField>

			<UFormField
				class="w-full"
				:label="$t('inputs.operationCategory')"
				name="operationCategoryId"
			>
				<USelect
					class="w-full"
					size="md"
					v-model="state.operationCategoryId"
					:items="data?.operationCategory"
					placeholder="12 093"
				/>
			</UFormField>

			<Transition name="dropdown" mode="out-in">
				<UFormField
					v-if="isExpenseCatVisible"
					class="w-full"
					:label="$t('inputs.expenseCategory')"
					name="expenseCategoryId"
				>
					<USelect
						class="w-full"
						size="md"
						v-model="state.expenseCategoryId"
						:items="data?.expenseCategory"
						placeholder="12 093"
					/>
				</UFormField>

				<UFormField
					v-else-if="isGoalsVisible"
					class="w-full"
					:label="$t('inputs.goals')"
					name="goals"
				>
					<USelect
						class="w-full"
						size="md"
						v-model="state.goalsId"
						:items="data?.goals"
					/>
				</UFormField>
			</Transition>
		</UForm>
	</BaseSlideOver>
</template>
