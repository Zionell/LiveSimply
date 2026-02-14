<script setup lang="ts">
definePageMeta({
	layout: "auth",
});

const { loginBy } = useAuth();

const providers = [
	{
		label: "Google",
		icon: "i-simple-icons-google",
		onClick: () => loginBy("google"),
	},
];
</script>

<template>
	<section class="flex flex-col justify-center items-center p-4 md:p-12">
		<UPageCard class="w-full max-w-md">
			<UAuthForm
				:title="$t(`signInAndSignUp.login`)"
				description="Enter your credentials to access your account."
				icon="i-lucide-user"
				:providers="providers"
			/>
		</UPageCard>
	</section>
</template>
