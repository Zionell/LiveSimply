import en from "@/i18n/locales/en.json";
import ru from "@/i18n/locales/ru.json";

export default defineI18nConfig(() => ({
	legacy: false,
	locale: "en",
	fallbackLocale: "en",
	messages: {
		en,
		ru,
	},
}));
