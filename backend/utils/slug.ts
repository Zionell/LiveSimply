const TRANSLIT_MAP: Record<string, string> = {
	а: "a",
	б: "b",
	в: "v",
	г: "g",
	д: "d",
	е: "e",
	ё: "e",
	ж: "zh",
	з: "z",
	и: "i",
	й: "i",
	к: "k",
	л: "l",
	м: "m",
	н: "n",
	о: "o",
	п: "p",
	р: "r",
	с: "s",
	т: "t",
	у: "u",
	ф: "f",
	х: "h",
	ц: "c",
	ч: "ch",
	ш: "sh",
	щ: "sch",
	ъ: "",
	ы: "y",
	ь: "",
	э: "e",
	ю: "yu",
	я: "ya",
};

/**
 * Turns a human label into a database-safe key: cyrillic is transliterated,
 * diacritics are dropped and anything else collapses into single dashes.
 * Returns an empty string when nothing latin survives — callers decide on
 * the fallback.
 */
export const slugify = (label: string): string => {
	const transliterated = label
		.toLowerCase()
		.split("")
		.map(char => TRANSLIT_MAP[char] ?? char)
		.join("");

	return transliterated
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
};
