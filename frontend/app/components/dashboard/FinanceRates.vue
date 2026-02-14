<script setup lang="ts">
import { splitThousandsFloat } from "~/assets/utils/numbers";

defineProps<{
	rates: ICurrentRate[];
}>();
</script>

<template>
	<CommonCardWrapper>
		<template #header>
			{{ $t("dashboard.rates") }}
		</template>

		<div class="flex gap-4 items-center">
			<div class="grid grid-cols-2 gap-x-8 text-sm">
				<div
					v-for="rate in rates"
					:key="`rate_${rate.curTo}_${rate.curFrom}`"
					class="flex gap-2 items-center"
				>
					<p>{{ rate.curFrom }}</p>

					<UIcon
						class="w-5 h-5"
						name="i-material-symbols:double-arrow"
					/>

					<p>{{ rate.curTo }}</p>
					<p>{{ splitThousandsFloat(rate.rate) }}</p>
				</div>
			</div>
		</div>
	</CommonCardWrapper>
</template>
