<script setup lang="ts">
import { z } from "zod";
import { api } from "~~/lib/api";
import { getError } from "~/assets/utils/common.ts";

const emit = defineEmits(["refresh"]);

interface IState {
	curPrice: number;
	currencyFromId: string;
	operationCategoryId: string;
	expenseCategoryId: string;
	goalsId: string;
}

const initialValues: IState = {
	curPrice: 0,
	currencyFromId: "",
	operationCategoryId: "",
	expenseCategoryId: "",
	goalsId: "",
};
const { t } = useI18n();

const schema = z.object({
	curPrice: z.number({ error: t("inputsErrors.required") }).min(0, { message: t("inputsErrors.min", { min: 0 }) }),
	currencyFromId: z.string({ error: t("inputsErrors.required") }).nonempty({ message: t("inputsErrors.required") }),
	operationCategoryId: z
		.string({
			error: t("inputsErrors.required"),
		})
		.nonempty({ message: t("inputsErrors.required") }),
	expenseCategoryId: z.string().optional(),
	goalsId: z.string().optional(),
});

const state = reactive<IState>({ ...initialValues });
const isLoading = ref<boolean>(false);
const toast = useToast();
const sliderOverRef = useTemplateRef("slideOver");

const { data, error, refresh } = await useFetch<FinanceSpecs>(api.finance.specs, {
	key: "FinanceSpecs",
});

if (error.value) {
	throw createError({
		statusCode: error.value?.statusCode,
		statusMessage: error.value?.statusMessage,
	});
}

const { isCreating, createCategory } = useExpenseCategory();

const isExpenseCatVisible = computed((): boolean => state.operationCategoryId === EOperationTypes.expense);

const isGoalsVisible = computed((): boolean => state.operationCategoryId === EOperationTypes.goals);

const isValid = computed(() => {
	return schema.safeParse(state).success;
});

async function onCreateCategory(label: string) {
	const category = await createCategory(label);

	if (!category) {
		return;
	}

	await refresh();
	state.expenseCategoryId = category.value;
}

async function onSubmit() {
	try {
		isLoading.value = true;

		const response = await $fetch<{ notifications: INotification[] }>(api.finance.common, {
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

		// TODO: check notifications
		const notifications = response?.notifications || [];

		if (notifications.length) {
			useNotificationsStore().push(notifications);

			notifications.forEach((notification) => {
				toast.add({
					title: notification.title,
					description: notification.text,
					color: "warning",
					icon: "i-lucide-triangle-alert",
				});
			});
		}

		await useUserStore().fetchUser();
	} catch (e) {
		console.warn("onSubmit: ", e);
		toast.add({
			title: getError(e) || t("common.error"),
			color: "error",
		});
	} finally {
		isLoading.value = false;
		sliderOverRef.value?.handleClose();
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
		btnIcon="i-lucide-plus"
		title="newFinance"
		:isDisabled="!isValid"
		:isLoading="isLoading"
		@close="handleClose"
		@click="onSubmit"
	>
		<UForm :schema="schema" :state="state" class="w-full flex flex-col items-center space-y-4" @submit="onSubmit">
			<UFormField class="w-full" :label="$t('inputs.curPrice')" name="curPrice">
				<UInput type="number" class="w-full" size="md" placeholder="12 093" v-model="state.curPrice" />
			</UFormField>

			<UFormField class="w-full" :label="$t('inputs.currencyFrom')" name="currencyFromId">
				<USelectMenu
					class="w-full"
					size="md"
					v-model="state.currencyFromId"
					:items="data?.exchange"
					placeholder="RUB"
					value-key="value"
					virtualize
				/>
			</UFormField>

			<UFormField class="w-full" :label="$t('inputs.operationCategory')" name="operationCategoryId">
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
					<USelectMenu
						class="w-full"
						size="md"
						v-model="state.expenseCategoryId"
						:items="data?.expenseCategory"
						placeholder="12 093"
						value-key="value"
						:loading="isCreating"
						create-item
						virtualize
						@create="onCreateCategory"
					>
						<template #create-item-label="{ item }">
							{{ $t("inputs.createExpenseCategory", { label: item }) }}
						</template>
					</USelectMenu>
				</UFormField>

				<UFormField v-else-if="isGoalsVisible" class="w-full" :label="$t('inputs.goals')" name="goals">
					<USelect class="w-full" size="md" v-model="state.goalsId" :items="data?.goals" />
				</UFormField>
			</Transition>
		</UForm>
	</ModalsBaseSlideOver>
</template>
