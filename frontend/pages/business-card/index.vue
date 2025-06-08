<script setup lang="ts">
import { api } from "@/lib/api.ts";
import type { IBusinessCard } from "@/types/businessCard.ts";

const {
	data: card,
	error,
	pending,
	refresh,
} = await useFetch<IBusinessCard>(api.businessCard.common);

if (error.value) {
	throw createError({
		statusCode: error.value?.statusCode,
		statusMessage: error.value?.statusMessage,
	});
}
</script>

<template>
	<section class="overflow-hidden grid gap-4">
		<SectionHeader classs="lg:p-0 px-4 lg:flex-row flex-col">
			<BusinessCardHeader :card="card" />
		</SectionHeader>

		<BusinessCardInfo v-if="card" :card="card" @refresh="refresh" />

		<BusinessCardContacts
			:links="card?.socialLinks"
			:cardId="card?.id"
			:loading="pending"
			@refresh="refresh"
		/>
	</section>
</template>
