<script setup lang="ts">
import { api } from "@/lib/api.ts";
import type { ICurrentRate } from "@/types/rates.ts";

export interface IFinances {
	income: number;
	expense: number;
}

export interface IChart {
	value: number;
	label: string;
	color: string;
}

interface IResponse {
	rates: ICurrentRate[];
	finances: IFinances;
	chart: IChart[];
}

const { data, error } = await useFetch<IResponse>(api.finance.statistics);

if (error.value) {
	throw createError({
		statusCode: error.value?.statusCode,
		statusMessage: error.value?.statusMessage,
	});
}
</script>

<template>
	<section>
		<DashboardHeader />

		<article class="flex flex-col gap-4">
			<div
				class="lg:grid flex flex-col lg:grid-cols-2 gap-4 lg:items-start"
			>
				<div class="flex flex-col gap-4">
					<DashboardFinanceStatistic :finances="data?.finances" />

					<DashboardFinanceRates
						v-if="data?.rates?.length"
						:rates="data?.rates"
					/>

					<DashboardGoals />
				</div>

				<DashboardFinanceStatisticChart
					v-if="data?.chart?.length"
					:data="data.chart"
					:totalExpense="data.finances.expense"
				/>
			</div>
		</article>
	</section>
</template>
