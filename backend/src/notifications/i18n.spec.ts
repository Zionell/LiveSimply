import * as fs from "fs";
import * as path from "path";
import { ENotificationType } from "./types";
import { SUPPORTED_LANGUAGES } from "../../utils/language";

const read = (lang: string): Record<string, any> =>
	JSON.parse(
		fs.readFileSync(
			path.join(__dirname, "..", "i18n", lang, "notification.json"),
			"utf-8"
		)
	);

const lookup = (source: Record<string, any>, key: string): unknown =>
	key.split(".").reduce<any>((node, part) => node?.[part], source);

describe("notification translations", () => {
	// A missing key silently renders as the key itself in the bell, so every
	// shipped language has to carry every type.
	it.each(SUPPORTED_LANGUAGES)("covers every type in %s", lang => {
		const source = read(lang);

		for (const type of Object.values(ENotificationType)) {
			expect(lookup(source, `${type}.title`)).toEqual(
				expect.any(String)
			);
			expect(lookup(source, `${type}.text`)).toEqual(expect.any(String));
		}
	});
});
