<script setup lang="ts">
import { z } from "zod";
import { api } from "~~/lib/api";
import { CalendarDate, DateFormatter, getLocalTimeZone } from "@internationalized/date";
import { getError } from "~/assets/utils/common.ts";

const emit = defineEmits(["refresh"]);

const initialValues = {
	title: "",
	total: 0,
	amount: 0,
	exchangeId: "",
};
const { t, locale } = useI18n();

const schema = z.object({
	title: z.string({ error: t("inputsErrors.required") }),
	total: z.number({ error: t("inputsErrors.required") }),
	amount: z.number({ error: t("inputsErrors.required") }),
	exchangeId: z.string({ error: t("inputsErrors.required") }).nonempty(),
});

const year = new Date().getFullYear();
const month = new Date().getMonth();
const day = new Date().getDate();
const untilAt = shallowRef(new CalendarDate(year, month + 1, day));
const df = new DateFormatter(locale.value, {
	dateStyle: "medium",
});
const sliderOverRef = useTemplateRef("sliderOver");
const state = reactive({ ...initialValues });
const isLoading = ref<boolean>(false);
const toast = useToast();

const { data, error } = await useFetch<FinanceSpecs>(api.finance.specs, {
	key: "FinanceSpecs",
});

if (error.value) {
	throw createError({
		statusCode: error.value?.statusCode,
		statusMessage: error.value?.statusMessage,
	});
}

const isValid = computed(() => schema.safeParse(state).success && untilAt.value);

async function onSubmit() {
	try {
		isLoading.value = true;

		await $fetch(api.goals.common, {
			method: "POST",
			body: JSON.stringify({
				...state,
				untilAt: untilAt.value ? untilAt.value.toDate(getLocalTimeZone()) : "",
			}),
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
			title: getError(e) || t("common.error"),
			color: "error",
		});
	} finally {
		isLoading.value = false;
		sliderOverRef.value?.handleClose();
	}
}

function handleCLose() {
	Object.assign(state, initialValues);
}
</script>

<template>
	<ModalsBaseSlideOver
		ref="sliderOver"
		btnLabel="new"
		btnIcon="i-lucide-plus"
		title="newBusinessLink"
		:isDisabled="!isValid"
		@close="handleCLose"
		@click="onSubmit"
	>
		<UForm :schema="schema" :state="state" class="w-full flex flex-col items-center space-y-4" @submit="onSubmit">
			<UFormField class="w-full" :label="$t('inputs.goalTitle')" name="title">
				<UInput class="w-full" size="md" :placeholder="$t('inputs.goalTitle')" v-model="state.title" />
			</UFormField>

			<UFormField class="w-full" :label="$t('inputs.exchange')" name="exchangeId">
				<USelect
					class="w-full"
					size="md"
					v-model="state.exchangeId"
					:items="data?.exchange"
					placeholder="RUB"
					:aria-label="$t('inputs.exchange')"
				/>
			</UFormField>

			<UFormField class="w-full" :label="$t('inputs.goalTotal')" name="total">
				<UInput type="number" class="w-full" size="md" placeholder="12 093" v-model="state.total" />
			</UFormField>

			<UFormField class="w-full" :label="$t('inputs.initialAmount')" name="amount">
				<UInput type="number" class="w-full" size="md" placeholder="1000" v-model="state.amount" />
			</UFormField>

			<UFormField class="w-full" :label="$t('inputs.untilAt')" name="curPrice">
				<UPopover>
					<UButton
						class="w-full"
						color="neutral"
						variant="outline"
						icon="i-lucide-calendar"
						:aria-label="$t('inputs.untilAt')"
					>
						{{ untilAt ? df.format(untilAt.toDate(getLocalTimeZone())) : $t("inputs.untilAt") }}
					</UButton>

					<template #content>
						<UCalendar v-model="untilAt" class="p-2" />
					</template>
				</UPopover>
			</UFormField>
		</UForm>
	</ModalsBaseSlideOver>
</template>
