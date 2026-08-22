import { normalizeLanguage } from "./language";

describe("normalizeLanguage", () => {
	it("keeps a language we ship translations for", () => {
		expect(normalizeLanguage("ru")).toBe("ru");
		expect(normalizeLanguage("en")).toBe("en");
	});

	it("strips the region a browser sends", () => {
		expect(normalizeLanguage("ru-RU")).toBe("ru");
		expect(normalizeLanguage("en-GB")).toBe("en");
	});

	it("is case-insensitive", () => {
		expect(normalizeLanguage("RU")).toBe("ru");
	});

	it("falls back for a language we do not ship", () => {
		expect(normalizeLanguage("de-DE")).toBe("en");
		expect(normalizeLanguage("zh")).toBe("en");
	});

	it("falls back for a missing value", () => {
		expect(normalizeLanguage()).toBe("en");
		expect(normalizeLanguage(null)).toBe("en");
		expect(normalizeLanguage("")).toBe("en");
	});
});
