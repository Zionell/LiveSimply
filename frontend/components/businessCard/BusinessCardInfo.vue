<script setup lang="ts">
import type { IBusinessCard } from "@/types/businessCard.ts";
import { z } from "zod";
import { api } from "@/lib/api.ts";

interface IProps {
	card: IBusinessCard;
}

const props = defineProps<IProps>();

const emit = defineEmits(["refresh"]);

const initialValues = {
	subtitle: props.card.subtitle || "",
	description: props.card.description || "",
};
const { t } = useI18n();

const schema = z.object({
	subtitle: z.string({ required_error: t("inputsErrors.required") }),
	description: z.string({ required_error: t("inputsErrors.required") }),
});

const state = reactive({ ...initialValues });
const isLoading = ref<boolean>(false);
const toast = useToast();

const isValid = computed(() => {
	return schema.safeParse(state).success;
});

async function handleSubmit() {
	try {
		isLoading.value = true;

		await $fetch(api.businessCard.common, {
			method: "POST",
			body: JSON.stringify(state),
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
			title:
				e?.data?.message?.[0] || e?.data?.message || t("common.error"),
			color: "error",
		});
	} finally {
		isLoading.value = false;
	}
}
</script>

<template>
	<CardWrapper>
		<template #header>
			{{ $t("businessCardInfo.sectionTitle") }}
		</template>

		<UForm
			:schema="schema"
			:state="state"
			class="w-full flex flex-col items-center space-y-4 mb-6"
			@submit="handleSubmit"
		>
			<UFormField
				class="w-full"
				:label="$t('businessCardInfo.subtitle')"
				name="total"
			>
				<UInput
					class="w-full"
					size="md"
					:placeholder="$t('businessCardInfo.subtitle')"
					v-model="state.subtitle"
				/>
			</UFormField>

			<UFormField
				class="w-full"
				:label="$t('businessCardInfo.description')"
				name="total"
			>
				<UTextarea
					class="w-full"
					size="md"
					:placeholder="$t('businessCardInfo.descriptionPlaceholder')"
					v-model="state.description"
				/>
			</UFormField>
		</UForm>
		<UButton
			:label="$t('buttons.save')"
			:disabled="!isValid"
			:loading="isLoading"
			@click="handleSubmit"
		/>
	</CardWrapper>
</template>
