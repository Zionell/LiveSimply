<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import { formatDate, normalizeDate } from "@vueuse/core";
import type { Row } from "@tanstack/table-core";
import { splitThousandsFloat } from "~/assets/utils/numbers";

interface IProps {
	isLoading?: boolean;
	pagination: IPagination;
	data: IPaginatedResponse<FinanceTransaction> | undefined;
}

const props = withDefaults(defineProps<IProps>(), {
	isLoading: false,
});

const emit = defineEmits<{
	"update:page": [value: number];
	delete: [value: string];
}>();

const { t } = useI18n();

const UButton = resolveComponent("UButton");
const UDropdownMenu = resolveComponent("UDropdownMenu");

const columns: TableColumn<FinanceTransaction>[] = [
	{
		accessorKey: "curPrice",
		header: t("financeTable.curPrice"),
		cell: ({ row }) => {
			const price: number = row.getValue("curPrice") || 0;
			const currency = row.original.exchangeFrom;
			return `${splitThousandsFloat(price)} ${currency}`;
		},
	},
	{
		accessorKey: "convertedPrice",
		header: t("financeTable.convertedPrice"),
		cell: ({ row }) => {
			const price: number = row.getValue("convertedPrice") || 0;
			const currency = row.original.exchangeTo;
			return `${splitThousandsFloat(price)} ${currency}`;
		},
	},
	{
		accessorKey: "operationCategory",
		header: t("financeTable.operationCategory"),
	},
	{
		accessorKey: "expenseCategory",
		header: t("financeTable.expenseCategory"),
	},
	{
		accessorKey: "createdAt",
		header: t("financeTable.createdAt"),
		cell: ({ row }) => {
			return formatDate(normalizeDate(row.getValue("createdAt")), "D-MM-YYYY");
		},
	},
	{
		id: "actions",
		cell: ({ row }) => {
			return h(
				"div",
				{ class: "text-right" },
				h(
					UDropdownMenu,
					{
						content: {
							align: "end",
						},
						items: getRowItems(row),
						"aria-label": "Actions dropdown",
					},
					() =>
						h(UButton, {
							icon: "i-lucide-ellipsis-vertical",
							color: "neutral",
							variant: "ghost",
							class: "ml-auto",
							"aria-label": "Actions dropdown",
						}),
				),
			);
		},
	},
];

const page = computed(() => Math.ceil(props.pagination.offset / props.pagination.limit) + 1);

function getRowItems(row: Row<FinanceTransaction>) {
	return [
		{
			label: "Delete",
			onSelect() {
				emit("delete", row.original.id);
			},
		},
	];
}
</script>

<template>
	<UTable
		class="w-full"
		sticky
		:loading="props.isLoading"
		:loading-state="{
			icon: 'i-heroicons-arrow-path-20-solid',
			label: $t('common.loading'),
		}"
		:progress="{ color: 'primary', animation: 'carousel' }"
		:data="props.data?.result"
		:columns="columns"
	/>

	<UPagination
		:items-per-page="props.pagination.limit"
		:total="props.data?.count"
		:page="page"
		@update:page="emit('update:page', $event)"
	/>
</template>
