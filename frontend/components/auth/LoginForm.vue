<script setup lang="ts">
import { z } from "zod";
import type { FormSubmitEvent } from "#ui/types";
import { ERoutes } from "@/types/routes.ts";

const { t } = useI18n();

const schema = z.object({
	email: z
		.string({ required_error: t("inputsErrors.required") })
		.email("Invalid email"),
	password: z
		.string({ required_error: t("inputsErrors.required") })
		.min(8, "Must be at least 8 characters"),
});

type Schema = z.output<typeof schema>;

const state = reactive({
	email: undefined,
	password: undefined,
});
const isLoading = ref<boolean>(false);
const userStore = useUserStore();
const toast = useToast();
const route = useRoute();
const router = useRouter();

const isValid = computed(() => {
	return schema.safeParse(state).success;
});

async function onSubmit(event: FormSubmitEvent<Schema>) {
	try {
		isLoading.value = true;
		await userStore.loginUser(event.data);

		const cbRoute = route.query.redirectUrl?.toString();
		router.replace(cbRoute || ERoutes.dashboard);
	} catch (e) {
		console.warn("onSubmit: ", e);
		toast.add({
			title: t(`signInAndSignUp.${e.data.message}`),
			color: "error",
		});
	} finally {
		isLoading.value = false;
	}
}
</script>

<template>
	<UForm
		:schema="schema"
		:state="state"
		class="w-full flex flex-col items-center space-y-4"
		@submit="onSubmit"
	>
		<UFormField class="w-full" :label="$t('inputs.email')" name="email">
			<UInput class="w-full" size="md" v-model="state.email" />
		</UFormField>

		<UFormField
			class="w-full"
			:label="$t('inputs.password')"
			name="password"
		>
			<UInput
				class="w-full"
				size="md"
				v-model="state.password"
				type="password"
			/>
		</UFormField>

		<UButton
			:loading="isLoading"
			block
			size="md"
			:disabled="!isValid"
			type="submit"
		>
			{{ $t("signInAndSignUp.loginBtn") }}
		</UButton>
	</UForm>
</template>
