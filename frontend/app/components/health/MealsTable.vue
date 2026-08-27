<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import type { Row } from "@tanstack/table-core";

const props = defineProps<{
	meals: IMeal[];
}>();

const emit = defineEmits<{
	delete: [value: string];
}>();

const { t } = useI18n();

const UButton = resolveComponent("UButton");
const UDropdownMenu = resolveComponent("UDropdownMenu");

const expanded = ref<Record<string, boolean>>({});

const columns: TableColumn<IMeal>[] = [
	{
		id: "expand",
		cell: ({ row }) =>
			h(UButton, {
				color: "neutral",
				variant: "ghost",
				icon: row.getIsExpanded() ? "i-lucide-chevron-down" : "i-lucide-chevron-right",
				"aria-label": t("health.nutrition.mealTotal"),
				onClick: () => row.toggleExpanded(),
			}),
	},
	{
		accessorKey: "mealType",
		header: t("health.nutrition.title"),
		cell: ({ row }) => t(`health.mealTypes.${row.original.mealType}`),
	},
	{
		id: "composition",
		header: t("health.nutrition.product"),
		cell: ({ row }) => row.original.items.map((item) => item.title).join(", ") || "—",
	},
	{
		accessorKey: "kcal",
		header: t("health.targetKcal"),
		cell: ({ row }) => String(row.original.kcal),
	},
	{
		id: "macros",
		header: `${t("health.protein")} / ${t("health.fat")} / ${t("health.carbs")}`,
		cell: ({ row }) =>
			`${row.original.proteinG} / ${row.original.fatG} / ${row.original.carbsG}`,
	},
	{
		id: "actions",
		cell: ({ row }) =>
			h(
				"div",
				{ class: "text-right" },
				h(
					UDropdownMenu,
					{ content: { align: "end" }, items: getRowItems(row) },
					() =>
						h(UButton, {
							icon: "i-lucide-ellipsis-vertical",
							color: "neutral",
							variant: "ghost",
							class: "ml-auto",
							"aria-label": "Actions dropdown",
						}),
				),
			),
	},
];

function getRowItems(row: Row<IMeal>) {
	return [
		{
			label: t("buttons.delete"),
			icon: "i-lucide-trash-2",
			onSelect() {
				emit("delete", row.original.id);
			},
		},
	];
}
</script>

<template>
	<UTable v-model:expanded="expanded" class="w-full" :data="props.meals" :columns="columns">
		<template #expanded="{ row }">
			<div class="grid gap-1 py-2 pl-10 text-sm">
				<div v-for="item in row.original.items" :key="item.id" class="flex gap-4 text-gray-400">
					<span class="grow">{{ item.title }}</span>
					<span>{{ item.grams }} {{ $t("health.gram") }}</span>
					<span>{{ item.kcal }}</span>
					<span>{{ item.proteinG }} / {{ item.fatG }} / {{ item.carbsG }}</span>
				</div>
			</div>
		</template>
	</UTable>
</template>
