export const DEFAULT_LANGUAGE = "en";

export const SUPPORTED_LANGUAGES: string[] = ["en", "ru"];

/**
 * Keeps anything reaching the database down to a language we actually ship
 * translations for.
 */
export const normalizeLanguage = (language?: string | null): string => {
	if (!language) {
		return DEFAULT_LANGUAGE;
	}

	const base = language.split("-")[0].toLowerCase();

	return SUPPORTED_LANGUAGES.includes(base) ? base : DEFAULT_LANGUAGE;
};
