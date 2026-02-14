<script setup lang="ts">
const userStore = useUserStore();
</script>

<template>
	<h2 class="flex lg:text-4xl text-2xl font-bold mb-6">
		{{ $t("dashboard.prefix") }},&nbsp;{{ userStore.user?.name }}
	</h2>
</template>
