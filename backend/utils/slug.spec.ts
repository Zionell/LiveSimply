import { slugify } from "./slug";

describe("slugify", () => {
	it("transliterates a cyrillic label", () => {
		expect(slugify("Кофе и завтраки")).toBe("kofe-i-zavtraki");
	});

	it("lowercases and dashes a latin label", () => {
		expect(slugify("Public Transport")).toBe("public-transport");
	});

	it("strips diacritics instead of dropping the letter", () => {
		expect(slugify("Café")).toBe("cafe");
	});

	it("collapses punctuation and trims dashes from the edges", () => {
		expect(slugify("  ---Дом / быт!!  ")).toBe("dom-byt");
	});

	it("keeps digits", () => {
		expect(slugify("Кредит 2026")).toBe("kredit-2026");
	});

	it("returns an empty string when nothing latin survives", () => {
		expect(slugify("日本語")).toBe("");
		expect(slugify("🎉")).toBe("");
	});
});
