<script setup lang="ts">
definePageMeta({
	layout: "auth",
});

const isLogin = ref<boolean>(true);

const formType = computed(() => (isLogin.value ? "login" : "registration"));

function handleClick() {
	isLogin.value = !isLogin.value;
}
</script>

<template>
	<section class="flex flex-col justify-center items-center p-4 md:p-12">
		<Transition mode="out-in">
			<div
				:key="`title_${formType}`"
				class="w-full flex flex-col items-center gap-4 md:gap-6"
			>
				<UAvatar icon="i-solar:lock-password-linear" />

				<h3 class="font-extrabold text-xl">
					{{ $t(`signInAndSignUp.${formType}`) }}
				</h3>

				<LoginForm v-if="isLogin" />
				<RegistrationFrom v-else />

				<div class="flex items-center md:flex-row text-center">
					{{ $t(`signInAndSignUp.${formType}Text`) }}
					&nbsp;
					<UButton variant="link" @click="handleClick">
						{{ $t(`signInAndSignUp.${formType}Link`) }}
					</UButton>
				</div>
			</div>
		</Transition>
	</section>
</template>
