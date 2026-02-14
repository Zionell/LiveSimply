<script setup lang="ts">
import { api } from "~~/lib/api";

const { t } = useI18n();
const toast = useToast();
const params = reactive<IPagination>({
	limit: 10,
	offset: 0,
	sort: "desc",
});

const { data, error, refresh, pending } = await useFetch<IPaginatedResponse<FinanceTransaction>>(api.finance.common, {
	params,
});

if (error.value) {
	throw createError({
		statusCode: error.value?.statusCode,
		statusMessage: error.value?.statusMessage,
	});
}

function handlePaginate(page: number) {
	params.offset = (page - 1) * params.limit;
}

async function handleDelete(id: string) {
	try {
		await $fetch(`${api.finance.common}${id}/`, {
			method: "DELETE",
		});

		handlePaginate(1);
		await refresh();
		toast.add({
			title: t("common.deleted"),
			color: "success",
			icon: "i-lucide-circle-check",
		});
	} catch (e) {
		console.warn("Finance list / handleDelete: ", e);
		toast.add({
			title: t("common.error"),
			color: "error",
			icon: "i-lucide-circle-check",
		});
	}
}
</script>

<template>
	<section class="overflow-hidden grid gap-4">
		<CommonSectionHeader classs="lg:p-0 px-4 lg:flex-row flex-col">
			<ModalsAddNewFinance @refresh="refresh" />
		</CommonSectionHeader>

		<FinanceTable
			:data="data"
			:pagination="params"
			:is-loading="pending"
			@update:page="handlePaginate"
			@delete="handleDelete"
		/>
	</section>
</template>
