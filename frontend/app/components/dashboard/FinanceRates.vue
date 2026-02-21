<script setup lang="ts">
import { splitThousandsFloat } from "~/assets/utils/numbers";
import { formatDate, normalizeDate } from "@vueuse/core";

const props = defineProps<{
	rates: ICurrentRate[];
	lastUpdated: string;
}>();

const date = computed(() => formatDate(normalizeDate(props.lastUpdated), "D-MM-YYYY"));
</script>

<template>
	<CommonCardWrapper>
		<template #header>
			{{ $t("dashboard.rates") }}
		</template>

		<div class="flex flex-col gap-4">
			<div class="grid grid-cols-2 gap-x-8 text-sm">
				<div v-for="rate in rates" :key="`rate_${rate.curTo}_${rate.curFrom}`" class="flex gap-2 items-center">
					<p>{{ rate.curFrom }}</p>

					<UIcon class="w-5 h-5" name="i-material-symbols:double-arrow" />

					<p>{{ rate.curTo }}</p>
					<p>{{ splitThousandsFloat(rate.rate) }}</p>
				</div>
			</div>
			<div>{{ $t("dashboard.ratesUpdated") }} {{ date }}</div>
		</div>
	</CommonCardWrapper>
</template>
