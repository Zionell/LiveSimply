import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class TranslateService {
	constructor(private readonly configService: ConfigService) {}

	async translate(val: string): Promise<string> {
		try {
			const res = await fetch(
				`${this.configService.get("TRANSLATE_API")}?q=${val}&langpair=en|ru`
			);
			const data = await res.json();

			return data?.responseData?.translatedText;
		} catch (e) {
			console.warn("[TranslateService / translate]: ", e);
			throw new Error(e);
		}
	}
}
