import type { ISpec } from "#shared/types";
import { api } from "~~/lib/api";
import { getError } from "~/assets/utils/common";
import { generateColorFromString } from "~/assets/utils/colors";

export default function useExpenseCategory() {
	const { t } = useI18n();
	const toast = useToast();
	const isCreating = ref<boolean>(false);

	async function createCategory(label: string): Promise<ISpec | null> {
		const title = label.trim();

		if (!title || isCreating.value) {
			return null;
		}

		try {
			isCreating.value = true;

			return await $fetch<ISpec>(api.finance.expenseCategories, {
				method: "POST",
				body: JSON.stringify({
					label: title,
					color: generateColorFromString(title),
				}),
			});
		} catch (e) {
			console.warn("useExpenseCategory / createCategory: ", e);
			toast.add({
				title: getError(e) || t("common.error"),
				color: "error",
			});

			return null;
		} finally {
			isCreating.value = false;
		}
	}

	return {
		isCreating,
		createCategory,
	};
}
