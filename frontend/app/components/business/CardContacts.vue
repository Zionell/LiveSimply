<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import { api } from "~~/lib/api";
import { getImage } from "~/assets/utils/images";

interface IProps {
	links: IBusinessCardLink[] | undefined;
	cardId: string | undefined;
	loading?: boolean;
}

const props = withDefaults(defineProps<IProps>(), {
	loading: false,
});

const emit = defineEmits(["refresh"]);

const UAvatar = resolveComponent("UAvatar");
const UCheckbox = resolveComponent("UCheckbox");
const UButton = resolveComponent("UButton");

const { t } = useI18n();
const toast = useToast();

const isUpdatingLoading = ref<boolean>(false);
const isDeletingLoading = ref<boolean>(false);

const columns: TableColumn<IBusinessCardLink>[] = [
	{
		accessorKey: "icon",
		header: t("businessCardLink.icon"),
		cell: ({ row }) => {
			return h("div", { class: "flex items-center gap-3" }, [
				h(UAvatar, {
					src: getImage(row.original),
					text: row.original.name?.slice(0, 2),
					size: "lg",
				}),
			]);
		},
	},
	{
		accessorKey: "name",
		header: t("businessCardLink.name"),
	},
	{
		accessorKey: "link",
		header: t("businessCardLink.link"),
	},
	{
		accessorKey: "isVisible",
		header: t("businessCardLink.visible"),
		cell: ({ row }) => {
			return h("div", { class: "flex items-center gap-3" }, [
				h(UCheckbox, {
					modelValue: row.original.isVisible,
					disabled: isUpdatingLoading.value,
					"onUpdate:modelValue": (value: boolean | "indeterminate") =>
						handleUpdate(row.original.id, !!value),
				}),
			]);
		},
	},
	{
		accessorKey: "id",
		header: () =>
			h("div", { class: "text-right" }, t("businessCardLink.action")),
		cell: ({ row }) => {
			return h("div", { class: "flex justify-end" }, [
				h(UButton, {
					icon: "material-symbols-light:delete-rounded",
					color: "error",
					disabled: isDeletingLoading.value,
					onClick: () => handleDelete(row.original.id),
				}),
			]);
		},
	},
];

async function handleUpdate(id: string, value: boolean): Promise<void> {
	try {
		isUpdatingLoading.value = true;
		await $fetch(`${api.businessCard.link}${id}/`, {
			method: "PATCH",
			body: {
				isVisible: value,
			},
		});
		emit("refresh");
		toast.add({
			title: t("common.updated"),
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
		isUpdatingLoading.value = false;
	}
}

async function handleDelete(id: string): Promise<void> {
	try {
		isDeletingLoading.value = true;
		await $fetch(`${api.businessCard.link}${id}/`, {
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
		isDeletingLoading.value = false;
	}
}
</script>

<template>
	<CommonCardWrapper>
		<template #header>
			{{ $t("businessCardLink.sectionTitle") }}
		</template>

		<UTable
			:loading="props.loading"
			:data="props.links"
			:columns="columns"
			class="flex-1"
		/>

		<div class="grid grid-cols-2 pt-6 gap-2 w-fit">
			<ModalsAddBusinessCardLink
				:cardId="props.cardId"
				@refresh="emit('refresh')"
			/>
		</div>
	</CommonCardWrapper>
</template>
