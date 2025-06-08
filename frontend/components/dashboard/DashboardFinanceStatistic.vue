<script setup lang="ts">
import { splitThousandsFloat } from "@/assets/utils/numbers.ts";
import type { IFinances } from "@/pages/dashboard/index.vue";

const props = defineProps<{
	finances: IFinances | null | undefined;
}>();

const userStore = useUserStore();
</script>

<template>
	<CardWrapper>
		<template #header>
			{{ $t("dashboard.balance") }}
		</template>

		<div
			class="flex justify-between lg:items-center lg:gap-4 gap-2 flex-wrap"
		>
			<div v-if="userStore.user?.total" class="lg:text-2xl text-xl">
				{{ splitThousandsFloat(userStore.user.total) }}&nbsp;
				{{ userStore.user?.exchange }}
			</div>
			<div
				class="flex items-center lg:justify-evenly h-full gap-5 overflow-hidden"
			>
				<div class="flex gap-4 items-center">
					<UIcon
						class="w-5 h-5 text-lime-600"
						name="streamline:graph-bar-increase-solid"
					/>
					<div class="text-sm" v-if="props.finances?.income">
						<p>{{ $t("dashboard.income") }}</p>
						<div>
							{{ splitThousandsFloat(props.finances.income) }}
							{{ userStore.user?.exchange }}
						</div>
					</div>
				</div>
				<div class="flex gap-4 items-center">
					<UIcon
						class="w-5 h-5 text-red-500"
						name="streamline:graph-bar-decrease-solid"
					/>
					<div class="text-sm" v-if="props.finances?.expense">
						<p>{{ $t("dashboard.expense") }}</p>
						<div>
							{{ splitThousandsFloat(props.finances.expense) }}
							{{ userStore.user?.exchange }}
						</div>
					</div>
				</div>
			</div>
		</div>
	</CardWrapper>
</template>
