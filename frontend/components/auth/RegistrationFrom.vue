<script setup lang="ts">
import { z } from "zod";
import type { Form, FormSubmitEvent } from "#ui/types";
import { ERoutes } from "@/types/routes.ts";

const { t } = useI18n();

const schema = z.object({
	name: z.string({ required_error: t("inputsErrors.required") }),
	email: z
		.string({ required_error: t("inputsErrors.required") })
		.email("Invalid email"),
	password: z
		.string({ required_error: t("inputsErrors.required") })
		.min(8, "Must be at least 8 characters"),
});

type Schema = z.output<typeof schema>;

const state = reactive({
	name: undefined,
	email: undefined,
	password: undefined,
});

const form = ref<Form<Schema>>();
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
		const timeout = 5000;
		isLoading.value = true;
		await userStore.registerUser(event.data);

		toast.add({
			title: t(`signInAndSignUp.successEmail`),
			duration: timeout,
		});

		setTimeout(async () => {
			await userStore.loginUser(event.data);

			const cbRoute = route.query.redirectUrl;
			router.replace(cbRoute || ERoutes.dashboard);
		}, timeout);
	} catch (e) {
		console.warn("onSubmit: ", e);
		toast.add({
			title: t(`signInAndSignUp.${e.data.message}`),
			color: "error",
		});

		isLoading.value = false;
	}
}
</script>

<template>
	<UForm
		ref="form"
		:schema="schema"
		:state="state"
		class="w-full flex flex-col items-center space-y-4"
		@submit="onSubmit"
	>
		<UFormField class="w-full" :label="$t('inputs.name')" name="name">
			<UInput class="w-full" size="md" v-model="state.name" />
		</UFormField>

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
			{{ $t("signInAndSignUp.registrationBtn") }}
		</UButton>
	</UForm>
</template>
