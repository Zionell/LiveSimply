<script setup lang="ts">
import { api } from "~~/lib/api";

const { t } = useI18n();
const toast = useToast();

const now = new Date();
const params = reactive({
	year: now.getUTCFullYear(),
	month: now.getUTCMonth() + 1,
});

const { data, error, refresh } = await useFetch<IPlanner>(api.planner.common, {
	key: "Planner",
	params,
});

function changeMonth(period: { year: number; month: number }) {
	params.year = period.year;
	params.month = period.month;
}

if (error.value) {
	throw createError({
		statusCode: error.value?.statusCode,
		statusMessage: error.value?.statusMessage,
	});
}

const usedCategories = computed((): string[] =>
	[...(data.value?.required || []), ...(data.value?.additional || [])].map((item) => item.expenseCategory.value),
);

async function removeItem(item: IBudgetItem) {
	try {
		await $fetch(api.planner.item(item.id), { method: "DELETE" });

		await refresh();
		toast.add({
			title: t("common.deleted"),
			color: "success",
			icon: "i-lucide-circle-check",
		});
	} catch (e) {
		console.warn("removeItem: ", e);
		toast.add({ title: t("common.error"), color: "error" });
	}
}
</script>

<template>
	<section class="overflow-hidden grid gap-4">
		<CommonSectionHeader>
			<PlannerMonthSwitcher :year="params.year" :month="params.month" @change="changeMonth" />

			<ModalsEditPlanner v-if="data" :planner="data" @refresh="refresh" />
			<ModalsAddBudgetItem v-if="data" :plannerId="data.id" :usedCategories="usedCategories" @refresh="refresh" />
		</CommonSectionHeader>

		<CommonSuspenseWrapper>
			<div v-if="data" class="grid gap-6">
				<PlannerSummary :planner="data" />

				<div class="grid gap-6 lg:grid-cols-2 lg:items-start">
					<div class="grid gap-6">
						<PlannerGroup
							:title="$t('financePlanner.required')"
							:items="data.required"
							:threshold="data.alertThreshold"
							:currency="data.currency"
							@remove="removeItem"
						/>

						<PlannerGroup
							:title="$t('financePlanner.additional')"
							:items="data.additional"
							:threshold="data.alertThreshold"
							:currency="data.currency"
							@remove="removeItem"
						/>
					</div>

					<PlannerChart :planner="data" class="lg:sticky lg:top-4" />
				</div>
			</div>
		</CommonSuspenseWrapper>
	</section>
</template>
