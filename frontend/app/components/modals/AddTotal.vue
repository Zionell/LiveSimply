<script setup lang="ts">
import { z } from "zod";
import { api } from "~~/lib/api";

const initialValues = {
	total: null,
	exchange: "",
};
const { t } = useI18n();

const schema = z.object({
	total: z.number({ error: t("inputsErrors.required") }),
	exchange: z.string({ error: t("inputsErrors.required") }).nonempty(),
});

const userStore = useUserStore();

const isOpen = ref<boolean>(false);
const state = reactive({ ...initialValues });
const isLoading = ref<boolean>(false);
const toast = useToast();

const { data, error } = await useFetch<FinanceSpecs>(api.finance.specs);

if (error.value) {
	throw createError({
		statusCode: error.value?.statusCode,
		statusMessage: error.value?.statusMessage,
	});
}

const isValid = computed(() => {
	return schema.safeParse(state).success;
});

async function handleSubmit() {
	try {
		isLoading.value = true;

		await userStore.updateUser(state);

		isOpen.value = false;
	} catch (e) {
		console.warn("onSubmit: ", e);
		toast.add({
			title: t("common.error"),
			color: "error",
		});
	} finally {
		isLoading.value = false;
	}
}

onMounted(() => {
	if (!userStore.user?.total) {
		isOpen.value = true;
	}
});
</script>

<template>
	<USlideover
		v-model:open="isOpen"
		:dismissible="false"
		:title="$t('modals.addTotal')"
		:description="$t('modalAddTotal.description')"
	>
		<template #body>
			<UForm
				:schema="schema"
				:state="state"
				class="w-full flex flex-col items-center space-y-4"
				@submit="handleSubmit"
			>
				<UFormField class="w-full" :label="$t('inputs.total')" name="total">
					<UInput type="number" class="w-full" size="md" placeholder="12 093" v-model="state.total" />
				</UFormField>

				<UFormField class="w-full" :label="$t('inputs.exchange')" name="exchange">
					<USelectMenu
						class="w-full"
						size="md"
						v-model="state.exchange"
						:items="data?.exchange"
						placeholder="RUB"
						value-key="value"
						virtualize
					/>
				</UFormField>
			</UForm>
		</template>

		<template #footer>
			<UButton
				block
				:disabled="!isValid"
				:loading="isLoading"
				:label="$t(`buttons.submit`)"
				@click="handleSubmit"
			/>
		</template>
	</USlideover>
</template>
