<script setup lang="ts">
import { z } from "zod";
import { api } from "~~/lib/api";
import { getError } from "~/assets/utils/common.ts";

const emit = defineEmits(["refresh"]);

const { t } = useI18n();
const toast = useToast();
const slideOverRef = useTemplateRef("slideOver");

const today = new Date().toISOString().slice(0, 10);

interface IRow {
	productId: string | null;
	grams: number | null;
}

const schema = z.object({
	date: z.string().nonempty({ message: t("inputsErrors.required") }),
	mealType: z.enum([
		EMealType.Breakfast,
		EMealType.Lunch,
		EMealType.Dinner,
		EMealType.Snack,
	]),
});

const state = reactive({
	date: today,
	mealType: EMealType.Breakfast,
});

const rows = ref<IRow[]>([{ productId: null, grams: null }]);
const isLoading = ref<boolean>(false);

const { data: products, error: productsError } = await useFetch<IProduct[]>(api.health.products, {
	key: "HealthProducts",
});

const mealTypeItems = computed(() =>
	Object.values(EMealType).map((value) => ({
		label: t(`health.mealTypes.${value}`),
		value,
	})),
);

// UInput type="number" runs input through Nuxt UI's looseToNumber, which
// returns the raw string ("") rather than null/NaN when parseFloat fails
// (i.e. when the field is cleared). rows is a dynamic array so we can't
// wrap each field in a named computed the way AddBodyEntry.vue does —
// instead every row's @update:model-value is routed through this same
// normaliser so row.grams can only ever hold a real number or null.
function toNullableNumber(value: unknown): number | null {
	if (value === null || value === undefined || value === "") {
		return null;
	}

	const num = typeof value === "number" ? value : Number(value);

	return Number.isNaN(num) ? null : num;
}

function setGrams(row: IRow, value: unknown) {
	row.grams = toNullableNumber(value);
}

// Mirrors backend/src/health/dto/meal-item.dto.ts (MealItemDto: @Min(1) @Max(5000))
// so an out-of-range grams value (e.g. 6000) is caught here instead of coming
// back as an untranslated class-validator error in a toast.
const gramsSchema = z.number().min(1).max(5000);

const filledRows = computed((): IRow[] =>
	rows.value.filter(
		(row) => row.productId && typeof row.grams === "number" && gramsSchema.safeParse(row.grams).success,
	),
);

// A row the user started (picked a product, or typed grams) but didn't finish.
// An untouched row (the seeded blank one, or one left behind after removeRow
// empties the list) has both fields null and is deliberately excluded here —
// otherwise the form could never be submitted at all.
const touchedRows = computed((): IRow[] =>
	rows.value.filter((row) => row.productId !== null || row.grams !== null),
);

const hasInvalidGrams = computed((): boolean =>
	rows.value.some(
		(row) => row.productId && typeof row.grams === "number" && !gramsSchema.safeParse(row.grams).success,
	),
);

// Any touched row that isn't a filled row is incomplete (missing a product,
// missing grams, or grams out of range) and must block submission — a
// half-finished row used to be silently dropped from the payload while the
// form still reported success.
const hasIncompleteRow = computed((): boolean => touchedRows.value.length !== filledRows.value.length);

const isValid = computed(
	() =>
		schema.safeParse(state).success &&
		filledRows.value.length > 0 &&
		filledRows.value.length === touchedRows.value.length,
);

// Предпросмотр считается на фронте только чтобы не сохранять вслепую.
// Сохранённые числа приходят с бэкенда и ими же перерисовывается таблица.
const preview = computed(() => {
	const byId = new Map((products.value || []).map((product) => [product.id, product]));

	return filledRows.value.reduce(
		(acc, row) => {
			const product = byId.get(row.productId as string);

			if (!product) {
				return acc;
			}

			const share = (row.grams as number) / 100;

			return {
				kcal: acc.kcal + Math.round(product.kcalPer100 * share),
				proteinG: +(acc.proteinG + product.proteinPer100 * share).toFixed(1),
				fatG: +(acc.fatG + product.fatPer100 * share).toFixed(1),
				carbsG: +(acc.carbsG + product.carbsPer100 * share).toFixed(1),
			};
		},
		{ kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 },
	);
});

function addRow() {
	rows.value.push({ productId: null, grams: null });
}

function removeRow(index: number) {
	rows.value.splice(index, 1);

	if (!rows.value.length) {
		addRow();
	}
}

async function onSubmit() {
	try {
		isLoading.value = true;

		await $fetch(api.health.meals, {
			method: "POST",
			body: JSON.stringify({
				date: state.date,
				mealType: state.mealType,
				items: filledRows.value.map((row) => ({
					productId: row.productId,
					grams: row.grams,
				})),
			}),
		});

		emit("refresh");
		toast.add({ title: t("common.added"), color: "success", icon: "i-lucide-circle-check" });
	} catch (e) {
		console.warn("AddMeal / onSubmit: ", e);
		toast.add({ title: getError(e) || t("common.error"), color: "error" });
	} finally {
		isLoading.value = false;
		slideOverRef.value?.handleClose();
	}
}

function handleClose() {
	state.date = today;
	state.mealType = EMealType.Breakfast;
	rows.value = [{ productId: null, grams: null }];
}
</script>

<template>
	<ModalsBaseSlideOver
		ref="slideOver"
		btnLabel="newMeal"
		btnIcon="i-lucide-plus"
		title="newMeal"
		:isDisabled="!isValid"
		:isLoading="isLoading"
		@close="handleClose"
		@click="onSubmit"
	>
		<UForm :schema="schema" :state="state" class="w-full flex flex-col space-y-4" @submit="onSubmit">
			<UFormField class="w-full" :label="$t('health.date')" name="date">
				<UInput v-model="state.date" type="date" :max="today" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.nutrition.mealType')" name="mealType">
				<USelect v-model="state.mealType" :items="mealTypeItems" value-key="value" class="w-full" size="md" />
			</UFormField>

			<div class="grid gap-3">
				<div v-for="(row, index) in rows" :key="index" class="grid grid-cols-[1fr_7rem_auto] gap-2 items-end">
					<HealthProductPicker v-model="row.productId" />

					<UInput
						:model-value="row.grams"
						type="number"
						step="1"
						size="md"
						:placeholder="$t('health.nutrition.grams')"
						@update:model-value="(value) => setGrams(row, value)"
					/>

					<UButton
						color="error"
						variant="ghost"
						icon="i-lucide-trash-2"
						:aria-label="$t('health.nutrition.removeProduct')"
						@click="removeRow(index)"
					/>
				</div>

				<UButton variant="subtle" icon="i-lucide-plus" :disabled="Boolean(productsError)" @click="addRow">
					{{ $t("health.nutrition.addProduct") }}
				</UButton>
			</div>

			<div class="text-sm text-gray-400">
				{{ $t("health.nutrition.mealTotal") }}: {{ preview.kcal }} —
				{{ preview.proteinG }} / {{ preview.fatG }} / {{ preview.carbsG }} {{ $t("health.gram") }}
			</div>

			<p v-if="hasInvalidGrams" class="text-xs text-amber-500">
				{{ $t("health.nutrition.gramsRange") }}
			</p>

			<p v-else-if="hasIncompleteRow" class="text-xs text-amber-500">
				{{ $t("health.nutrition.incompleteRow") }}
			</p>

			<p v-else-if="!filledRows.length" class="text-xs text-amber-500">
				{{ $t("health.nutrition.needProduct") }}
			</p>
		</UForm>
	</ModalsBaseSlideOver>
</template>
