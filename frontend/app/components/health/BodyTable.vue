<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import type { Row } from "@tanstack/table-core";

const props = defineProps<{
	entries: IBodyEntry[];
}>();

const emit = defineEmits<{
	delete: [value: string];
}>();

const { t, locale } = useI18n();

const UButton = resolveComponent("UButton");
const UDropdownMenu = resolveComponent("UDropdownMenu");

const dash = "—";

const formatDate = (value: string): string =>
	new Intl.DateTimeFormat(locale.value, {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		timeZone: "UTC",
	}).format(new Date(value));

const numberCell = (value: number | null): string =>
	value === null ? dash : String(value);

const columns: TableColumn<IBodyEntry>[] = [
	{
		accessorKey: "date",
		header: t("health.date"),
		cell: ({ row }) => formatDate(row.original.date),
	},
	{
		accessorKey: "weightKg",
		header: t("health.weight"),
		cell: ({ row }) => numberCell(row.original.weightKg),
	},
	{
		accessorKey: "chestCm",
		header: t("health.chest"),
		cell: ({ row }) => numberCell(row.original.chestCm),
	},
	{
		accessorKey: "waistCm",
		header: t("health.waist"),
		cell: ({ row }) => numberCell(row.original.waistCm),
	},
	{
		accessorKey: "armCm",
		header: t("health.arm"),
		cell: ({ row }) => numberCell(row.original.armCm),
	},
	{
		accessorKey: "note",
		header: t("health.note"),
		cell: ({ row }) => row.original.note || dash,
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

function getRowItems(row: Row<IBodyEntry>) {
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
	<CommonCardWrapper>
		<template #header>{{ $t("health.logTitle") }}</template>

		<UTable class="w-full" sticky :data="props.entries" :columns="columns" />
	</CommonCardWrapper>
</template>
