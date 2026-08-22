<script setup lang="ts">
import { splitThousandsFloat } from "~/assets/utils/numbers";

const props = defineProps<{
	item: IBudgetItem;
	threshold: number;
	currency: string;
}>();

const emit = defineEmits(["remove"]);

const percent = computed((): number => Math.round(props.item.progress * 100));

const color = computed((): UiColors => {
	if (props.item.progress >= 1) {
		return UiColors.error;
	}

	if (props.item.progress >= props.threshold) {
		return UiColors.warning;
	}

	return UiColors.success;
});
</script>

<template>
	<CommonCardWrapper>
		<template #header>
			<div class="flex items-center justify-between gap-2">
				<span class="flex items-center gap-2">
					<span
						class="inline-block w-2 h-2 rounded-full"
						:style="{ backgroundColor: props.item.expenseCategory.color }"
					/>
					{{ props.item.label }}
				</span>

				<UButton
					color="error"
					variant="ghost"
					icon="i-lucide-trash-2"
					:aria-label="$t('buttons.delete')"
					@click="emit('remove', props.item)"
				/>
			</div>
		</template>

		<div class="flex flex-col gap-2">
			<div class="text-xs text-gray-400">
				{{ props.item.expenseCategory.label }}
			</div>

			<UProgress :model-value="Math.min(percent, 100)" :color="color" />

			<div class="text-xs">
				{{
					$t("financePlanner.ofPlan", {
						spent: splitThousandsFloat(props.item.spent),
						planned: splitThousandsFloat(props.item.convertedAmount),
						currency: props.currency,
					})
				}}
				&nbsp;·&nbsp; {{ percent }}%
			</div>
		</div>
	</CommonCardWrapper>
</template>
