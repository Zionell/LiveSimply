<script setup lang="ts">
import { normalizeDate } from "@vueuse/core";
import { api } from "~~/lib/api";
import {
	countPercentage,
	splitThousands,
	splitThousandsFloat,
} from "~/assets/utils/numbers";

const props = defineProps<{
	goal: IGoal;
}>();

const emit = defineEmits(["refresh"]);

const { t } = useI18n();
const toast = useToast();
const isLoading = ref<boolean>(false);

const percentage = computed((): number =>
	countPercentage(props.goal.amount, props.goal.total),
);

const goalAchievement = computed((): string => {
	const { untilAt, createdAt, total, amount, exchangeId } = props.goal;

	if (amount >= total) {
		return t("goals.completed");
	}

	const normalizesDate = normalizeDate(untilAt);
	const normalizesCreatedAt = normalizeDate(createdAt);
	let monthDiff =
		(normalizesDate.getFullYear() - normalizesCreatedAt.getFullYear()) * 12;
	monthDiff += normalizesDate.getMonth() - normalizesCreatedAt.getMonth();

	const amountDiff = total - amount;
	const monthlyPayment = splitThousandsFloat(amountDiff / monthDiff);

	const res = monthDiff
		? `${monthlyPayment} ${exchangeId}`
		: `${amountDiff} ${exchangeId}`;

	return monthDiff
		? t("goals.achievement", { amount: res })
		: t("goals.toComplete", { amount: res });
});

async function handleDelete() {
	try {
		isLoading.value = true;
		await $fetch(`${api.goals.common}${props.goal.id}/`, {
			method: "DELETE",
		});
		emit("refresh");
		toast.add({
			title: t("common.deleted"),
			color: "success",
			icon: "i-lucide-circle-check",
		});
	} catch (e) {
		console.warn("[GoalsDetail/ handleDelete] error: ", e);
		toast.add({
			title: t("common.error"),
			color: "error",
			icon: "i-lucide-circle-check",
		});
	} finally {
		isLoading.value = false;
	}
}
</script>

<template>
	<div class="flex flex-col gap-6">
		<Transition mode="out-in">
			<CommonCardWrapper
				:key="props.goal.id"
				classs="lg:p-4 lg:mb-6 mb-4 h-fit"
			>
				<template #header>{{ props.goal.title }}</template>

				<div>
					{{ goalAchievement }}
				</div>
			</CommonCardWrapper>
		</Transition>
		<Transition mode="out-in">
			<CommonCardWrapper
				:key="props.goal.id"
				classs="lg:p-4 lg:mb-6 mb-4 h-fit"
			>
				<template #header>{{ $t("goals.progress") }}</template>

				<div
					class="flex justify-between items-center mb-4 md:text-base text-sm font-bold"
				>
					<div>
						{{ splitThousandsFloat(goal.amount) }}
						{{ goal.exchangeId }}
					</div>
					<div>
						{{ splitThousands(goal.total) }} {{ goal.exchangeId }}
					</div>
				</div>

				<UProgress
					aria-label="Loading..."
					size="md"
					:modelValue="percentage"
				/>
			</CommonCardWrapper>
		</Transition>

		<ModalsDeletionConfirmation
			class="self-end"
			:isLoading="isLoading"
			@submit="handleDelete"
		/>
	</div>
</template>
