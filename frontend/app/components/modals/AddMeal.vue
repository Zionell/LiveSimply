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
	// Строка описывает либо продукт из справочника, либо введённые руками
	// КБЖУ. Оба набора полей живут в одной строке, чтобы переключение режима
	// не стирало то, что пользователь уже набрал.
	isManual: boolean;
	productId: string | null;
	grams: number | null;
	title: string;
	kcalPer100: number | null;
	proteinPer100: number | null;
	fatPer100: number | null;
	carbsPer100: number | null;
	saveToCatalogue: boolean;
}

const createRow = (): IRow => ({
	isManual: false,
	productId: null,
	grams: null,
	title: "",
	kcalPer100: null,
	proteinPer100: null,
	fatPer100: null,
	carbsPer100: null,
	saveToCatalogue: false,
});

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

const rows = ref<IRow[]>([createRow()]);
const isLoading = ref<boolean>(false);

const {
	data: products,
	error: productsError,
	refresh: refreshProducts,
} = await useFetch<IProduct[]>(api.health.products, {
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
// instead every numeric field's @update:model-value is routed through this
// same normaliser so it can only ever hold a real number or null.
function toNullableNumber(value: unknown): number | null {
	if (value === null || value === undefined || value === "") {
		return null;
	}

	const num = typeof value === "number" ? value : Number(value);

	return Number.isNaN(num) ? null : num;
}

function setNumber(row: IRow, field: keyof IRow, value: unknown) {
	(row[field] as number | null) = toNullableNumber(value);
}

// Mirrors backend/src/health/dto/meal-item.dto.ts so an out-of-range value is
// caught here instead of coming back as an untranslated class-validator error.
const gramsSchema = z.number().min(1).max(5000);
const kcalSchema = z.number().min(0).max(1000);
const macroSchema = z.number().min(0).max(100);

const isValidGrams = (row: IRow): boolean =>
	typeof row.grams === "number" && gramsSchema.safeParse(row.grams).success;

const hasValidMacros = (row: IRow): boolean =>
	kcalSchema.safeParse(row.kcalPer100).success &&
	macroSchema.safeParse(row.proteinPer100).success &&
	macroSchema.safeParse(row.fatPer100).success &&
	macroSchema.safeParse(row.carbsPer100).success;

const isFilled = (row: IRow): boolean =>
	row.isManual
		? Boolean(row.title.trim()) && isValidGrams(row) && hasValidMacros(row)
		: Boolean(row.productId) && isValidGrams(row);

// A row the user started but didn't finish. An untouched row (the seeded blank
// one, or one left behind after removeRow empties the list) is deliberately
// excluded — otherwise the form could never be submitted at all.
const isTouched = (row: IRow): boolean =>
	row.isManual
		? Boolean(row.title.trim()) ||
			row.grams !== null ||
			row.kcalPer100 !== null ||
			row.proteinPer100 !== null ||
			row.fatPer100 !== null ||
			row.carbsPer100 !== null
		: row.productId !== null || row.grams !== null;

const filledRows = computed((): IRow[] => rows.value.filter(isFilled));

const touchedRows = computed((): IRow[] => rows.value.filter(isTouched));

const hasInvalidGrams = computed((): boolean =>
	rows.value.some((row) => row.grams !== null && !isValidGrams(row)),
);

// Отдельное сообщение про диапазон КБЖУ: «строка не заполнена» ничего не
// говорит человеку, который ввёл 900 г белка на 100 г продукта.
const hasInvalidMacros = computed((): boolean =>
	rows.value.some(
		(row) =>
			row.isManual &&
			isTouched(row) &&
			[row.kcalPer100, row.proteinPer100, row.fatPer100, row.carbsPer100].some(
				(value) => value !== null,
			) &&
			!hasValidMacros(row),
	),
);

const hasIncompleteRow = computed(
	(): boolean => touchedRows.value.length !== filledRows.value.length,
);

const hasIncompleteManualRow = computed((): boolean =>
	rows.value.some((row) => row.isManual && isTouched(row) && !isFilled(row)),
);

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
			const source = row.isManual
				? {
						kcalPer100: row.kcalPer100 as number,
						proteinPer100: row.proteinPer100 as number,
						fatPer100: row.fatPer100 as number,
						carbsPer100: row.carbsPer100 as number,
					}
				: byId.get(row.productId as string);

			if (!source) {
				return acc;
			}

			const share = (row.grams as number) / 100;

			return {
				kcal: acc.kcal + Math.round(source.kcalPer100 * share),
				proteinG: +(acc.proteinG + source.proteinPer100 * share).toFixed(1),
				fatG: +(acc.fatG + source.fatPer100 * share).toFixed(1),
				carbsG: +(acc.carbsG + source.carbsPer100 * share).toFixed(1),
			};
		},
		{ kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 },
	);
});

function addRow() {
	rows.value.push(createRow());
}

function removeRow(index: number) {
	rows.value.splice(index, 1);

	if (!rows.value.length) {
		addRow();
	}
}

/**
 * Строки с галочкой «сохранить в справочник» заводятся продуктами до отправки
 * приёма пищи и уходят уже как обычные позиции с productId. Если справочник
 * ответил ошибкой — приём пищи всё равно сохраняем, но ручной позицией: терять
 * набранное из-за отказа второстепенного запроса нельзя.
 */
async function toItems() {
	let savedAny = false;
	let failedAny = false;

	const items = [];

	for (const row of filledRows.value) {
		if (!row.isManual) {
			items.push({ productId: row.productId, grams: row.grams });
			continue;
		}

		const manualItem = {
			title: row.title.trim(),
			grams: row.grams,
			kcalPer100: row.kcalPer100,
			proteinPer100: row.proteinPer100,
			fatPer100: row.fatPer100,
			carbsPer100: row.carbsPer100,
		};

		if (!row.saveToCatalogue) {
			items.push(manualItem);
			continue;
		}

		try {
			const product = await $fetch<IProduct>(api.health.products, {
				method: "POST",
				body: {
					title: manualItem.title,
					kcalPer100: manualItem.kcalPer100,
					proteinPer100: manualItem.proteinPer100,
					fatPer100: manualItem.fatPer100,
					carbsPer100: manualItem.carbsPer100,
				} satisfies ICreateProductPayload,
			});

			savedAny = true;
			items.push({ productId: product.id, grams: row.grams });
		} catch (e) {
			console.warn("AddMeal / saveProduct: ", e);
			failedAny = true;
			items.push(manualItem);
		}
	}

	return { items, savedAny, failedAny };
}

async function onSubmit() {
	try {
		isLoading.value = true;

		const { items, savedAny, failedAny } = await toItems();

		await $fetch(api.health.meals, {
			method: "POST",
			body: JSON.stringify({
				date: state.date,
				mealType: state.mealType,
				items,
			}),
		});

		if (savedAny) {
			await refreshProducts();
			toast.add({
				title: t("health.nutrition.productSaved"),
				color: "success",
				icon: "i-lucide-circle-check",
			});
		}

		if (failedAny) {
			toast.add({ title: t("health.nutrition.productSaveError"), color: "warning" });
		}

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
	rows.value = [createRow()];
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
				<div
					v-for="(row, index) in rows"
					:key="index"
					class="grid gap-2 rounded-lg border border-gray-200 dark:border-gray-800 p-3"
				>
					<div class="flex items-center justify-between gap-2">
						<USwitch
							v-model="row.isManual"
							size="sm"
							:label="row.isManual ? $t('health.nutrition.manualEntry') : $t('health.nutrition.fromCatalogue')"
						/>

						<UButton
							color="error"
							variant="ghost"
							icon="i-lucide-trash-2"
							:aria-label="$t('health.nutrition.removeProduct')"
							@click="removeRow(index)"
						/>
					</div>

					<div class="grid grid-cols-[1fr_7rem] gap-2 items-end">
						<HealthProductPicker v-if="!row.isManual" v-model="row.productId" />

						<UInput
							v-else
							v-model="row.title"
							size="md"
							maxlength="100"
							:placeholder="$t('health.nutrition.productTitle')"
						/>

						<UInput
							:model-value="row.grams"
							type="number"
							step="1"
							size="md"
							:placeholder="$t('health.nutrition.grams')"
							@update:model-value="(value) => setNumber(row, 'grams', value)"
						/>
					</div>

					<template v-if="row.isManual">
						<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
							<UInput
								:model-value="row.kcalPer100"
								type="number"
								step="1"
								size="md"
								:placeholder="`${$t('health.kcal')} / 100 ${$t('health.gram')}`"
								@update:model-value="(value) => setNumber(row, 'kcalPer100', value)"
							/>

							<UInput
								:model-value="row.proteinPer100"
								type="number"
								step="0.1"
								size="md"
								:placeholder="`${$t('health.protein')} / 100 ${$t('health.gram')}`"
								@update:model-value="(value) => setNumber(row, 'proteinPer100', value)"
							/>

							<UInput
								:model-value="row.fatPer100"
								type="number"
								step="0.1"
								size="md"
								:placeholder="`${$t('health.fat')} / 100 ${$t('health.gram')}`"
								@update:model-value="(value) => setNumber(row, 'fatPer100', value)"
							/>

							<UInput
								:model-value="row.carbsPer100"
								type="number"
								step="0.1"
								size="md"
								:placeholder="`${$t('health.carbs')} / 100 ${$t('health.gram')}`"
								@update:model-value="(value) => setNumber(row, 'carbsPer100', value)"
							/>
						</div>

						<UCheckbox
							v-model="row.saveToCatalogue"
							size="sm"
							:label="$t('health.nutrition.saveToCatalogue')"
						/>
					</template>
				</div>

				<UButton variant="subtle" icon="i-lucide-plus" @click="addRow">
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

			<p v-else-if="hasInvalidMacros" class="text-xs text-amber-500">
				{{ $t("health.nutrition.macroRange") }}
			</p>

			<p v-else-if="hasIncompleteManualRow" class="text-xs text-amber-500">
				{{ $t("health.nutrition.manualIncomplete") }}
			</p>

			<p v-else-if="hasIncompleteRow" class="text-xs text-amber-500">
				{{ $t("health.nutrition.incompleteRow") }}
			</p>

			<p v-else-if="!filledRows.length" class="text-xs text-amber-500">
				{{ $t("health.nutrition.needProduct") }}
			</p>

			<p v-if="productsError" class="text-xs text-amber-500">
				{{ $t("health.nutrition.catalogueError") }}
			</p>
		</UForm>
	</ModalsBaseSlideOver>
</template>
