import { NotificationSerializer } from "./notification.serializer";
import { ENotificationType } from "../types";
import en from "../../i18n/en/notification.json";
import ru from "../../i18n/ru/notification.json";

const i18nMock = {
	translate: jest.fn(
		(
			key: string,
			options: { lang: string; args: Record<string, unknown> }
		) => `${options.lang}:${key}:${JSON.stringify(options.args)}`
	),
} as any;

const baseNotification = {
	id: "n1",
	userId: "u1",
	type: ENotificationType.BudgetItemThreshold,
	params: {
		label: "Rent",
		percent: 70,
		spent: 700,
		planned: 1000,
		currency: "EUR",
	},
	isReaded: false,
	createdAt: new Date("2026-08-10T00:00:00.000Z"),
	updatedAt: new Date("2026-08-10T00:00:00.000Z"),
};

describe("NotificationSerializer", () => {
	beforeEach(() => {
		i18nMock.translate.mockClear();
	});

	it("renders title and text from the notification type and params", () => {
		const result = NotificationSerializer.serialize(
			baseNotification as any,
			i18nMock,
			"en"
		);

		expect(i18nMock.translate).toHaveBeenCalledWith(
			"notification.budget.item.threshold.title",
			{ lang: "en", args: baseNotification.params }
		);
		expect(result?.title).toContain(
			"en:notification.budget.item.threshold.title"
		);
		expect(result?.text).toContain(
			"en:notification.budget.item.threshold.text"
		);
		expect(result?.id).toBe("n1");
		expect(result?.isReaded).toBe(false);
	});

	it("renders the same notification in another language", () => {
		const result = NotificationSerializer.serialize(
			baseNotification as any,
			i18nMock,
			"ru"
		);

		expect(result?.title).toContain(
			"ru:notification.budget.item.threshold.title"
		);
	});

	it("returns null for an unknown notification type instead of throwing", () => {
		const result = NotificationSerializer.serialize(
			{ ...baseNotification, type: "some.removed.type" } as any,
			i18nMock,
			"en"
		);

		expect(result).toBeNull();
		expect(i18nMock.translate).not.toHaveBeenCalled();
	});

	it("drops unknown types from a list without dropping valid ones", () => {
		const result = NotificationSerializer.serializeMany(
			[
				baseNotification,
				{ ...baseNotification, id: "n2", type: "some.removed.type" },
				{
					...baseNotification,
					id: "n3",
					type: ENotificationType.BudgetTotalThreshold,
				},
			] as any,
			i18nMock,
			"en"
		);

		expect(result.map(n => n.id)).toEqual(["n1", "n3"]);
	});

	it("tolerates a notification with empty params", () => {
		const result = NotificationSerializer.serialize(
			{ ...baseNotification, params: null } as any,
			i18nMock,
			"en"
		);

		expect(i18nMock.translate).toHaveBeenCalledWith(
			"notification.budget.item.threshold.title",
			{ lang: "en", args: {} }
		);
		expect(result).not.toBeNull();
	});
});

describe("notification locales", () => {
	const locales: Record<string, Record<string, any>> = { en, ru };

	const read = (locale: Record<string, any>, type: string, part: string) =>
		`${type}.${part}`
			.split(".")
			.reduce<any>((node, key) => node?.[key], locale);

	const placeholders = (template: string): string[] =>
		[...template.matchAll(/{(\w+)}/g)].map(match => match[1]).sort();

	it.each(Object.values(ENotificationType))(
		"has a title and a text for %s in every language",
		type => {
			for (const [lang, locale] of Object.entries(locales)) {
				expect(typeof read(locale, type, "title")).toBe("string");
				expect(typeof read(locale, type, "text")).toBe("string");
				expect(read(locale, type, "title")).not.toBe("");
				expect(lang).toBeTruthy();
			}
		}
	);

	it.each(Object.values(ENotificationType))(
		"uses the same placeholders for %s in every language",
		type => {
			for (const part of ["title", "text"]) {
				expect(placeholders(read(ru, type, part))).toEqual(
					placeholders(read(en, type, part))
				);
			}
		}
	);
});
