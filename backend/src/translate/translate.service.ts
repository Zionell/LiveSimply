import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class TranslateService {
	constructor(private readonly configService: ConfigService) {}

	async translate(val: string): Promise<string> {
		try {
			const body = {
				text: val,
				to: "ru",
				from: "en",
			};

			const res = await fetch(
				`${this.configService.get("TRANSLATE_API")}`,
				{
					method: "POST",
					body: JSON.stringify(body),
					headers: {
						"Content-Type": "application/json",
						"x-rapidapi-key":
							this.configService.get("TRANSLATE_KEY"),
					},
				}
			);
			const data = await res.json();

			return data?.trans;
		} catch (e) {
			console.warn("[TranslateService / translate]: ", e);
			throw new Error(e);
		}
	}
}
