<script setup lang="ts">
import { z } from "zod";
import { api } from "~~/lib/api";
import { getError } from "~/assets/utils/common.ts";

interface IProps {
	cardId: string | undefined;
}

const props = defineProps<IProps>();

const emit = defineEmits(["refresh"]);

const initialValues = {
	name: "",
	icon: "",
	link: "",
	isVisible: false,
};
const { t } = useI18n();

const schema = z.object({
	name: z.string({ error: t("inputsErrors.required") }),
	icon: z.string({ error: t("inputsErrors.required") }),
	link: z.string({ error: t("inputsErrors.required") }),
	isVisible: z.boolean(),
});

const sliderOverRef = useTemplateRef("sliderOver");
const state = reactive({ ...initialValues });
const isLoading = ref<boolean>(false);
const toast = useToast();

const isValid = computed(() => {
	return schema.safeParse(state).success;
});

async function onSubmit() {
	try {
		isLoading.value = true;

		await $fetch(api.businessCard.link, {
			method: "POST",
			body: JSON.stringify({
				...state,
				cardId: props.cardId,
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
		title="newBusinessLink"
		:isDisabled="!isValid || !props.cardId"
		@close="handleCLose"
		@click="onSubmit"
	>
		<UForm :schema="schema" :state="state" class="w-full flex flex-col items-center space-y-4" @submit="onSubmit">
			<UFormField class="w-full" :label="$t('inputs.linkName')" name="linkName">
				<UInput class="w-full" size="md" :placeholder="$t('inputs.linkName')" v-model="state.name" />
			</UFormField>

			<UFormField class="w-full" :label="$t('inputs.link')" name="link">
				<UInput class="w-full" size="md" :placeholder="$t('inputs.link')" v-model="state.link" />
			</UFormField>

			<UFormField v-if="false" class="w-full" :label="$t('inputs.icon')" name="icon">
				<UInput class="w-full" size="md" :placeholder="$t('inputs.icon')" v-model="state.icon" />
			</UFormField>

			<UFormField class="w-full" :label="$t('inputs.visibility')" name="visibility">
				<USwitch class="w-full" size="md" :placeholder="$t('inputs.visibility')" v-model="state.isVisible" />
			</UFormField>
		</UForm>
	</ModalsBaseSlideOver>
</template>
