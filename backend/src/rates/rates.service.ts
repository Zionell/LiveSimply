import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TranslateService } from "~/translate/translate.service";
import { PrismaService } from "~/prisma.service";
import { roleRestrictions } from "@/utils/rolesRestrictions";
import { ConvertRatesDto } from "./dto/convert-rates.dto";
import { MailService } from "~/mail/mail.service";
import * as expenseCategory from "@/static/expenseCategory.json";
import * as operationCategory from "@/static/operationCategory.json";
import { Cron, CronExpression } from "@nestjs/schedule";
import { I18nContext } from "nestjs-i18n";
import { ERole } from "@/types/user";
import { ExchangeItem } from "@/generated/prisma/client";

@Injectable()
export class RatesService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly configService: ConfigService,
		private readonly translateService: TranslateService,
		private readonly mailService: MailService
	) {}

	private async createOperationCategory() {
		try {
			for (const category of operationCategory) {
				await this.prismaService.operationCategory.upsert({
					where: {
						value: category.value,
					},
					update: {},
					create: {
						value: category.value,
						label: {
							create: [
								{ label: category.en, lang: "en" },
								{ label: category.ru, lang: "ru" },
							],
						},
					},
				});
			}
		} catch (e) {
			console.warn("[RatesService / createOperationCategory]: ", e);
			throw new Error(e);
		}
	}

	private async createExpenseCategory() {
		try {
			for (const category of expenseCategory) {
				await this.prismaService.expenseCategory.upsert({
					where: {
						value: category.value,
					},
					update: {},
					create: {
						value: category.value,
						color: category.color,
						label: {
							create: [
								{ label: category.en, lang: "en" },
								{ label: category.ru, lang: "ru" },
							],
						},
					},
				});
			}
		} catch (e) {
			console.warn("[RatesService / createExpenseCategory]: ", e);
			throw new Error(e);
		}
	}

	private async createExchangeItem() {
		try {
			const res = await fetch(
				`${this.configService.get("CURRENCY_API")}symbols?access_key=${this.configService.get("CONVERT_CURRENCY")}`
			);
			const data = await res.json();
			const symbolsArr = Object.entries(data.symbols);

			for (let i = 0; i < symbolsArr.length; i++) {
				const [key, val] = symbolsArr[i];
				await this.prismaService.exchangeItem.upsert({
					where: {
						value: key,
					},
					update: {},
					create: {
						value: String(key) || "",
						base: null,
						rate: null,
						label: {
							create: [
								{ label: String(val) || "", lang: "en" },
								{
									label: await this.translateService.translate(
										String(val)
									),
									lang: "ru",
								},
							],
						},
					},
				});
			}
		} catch (e) {
			console.warn("[RatesService / createExchangeItem]: ", e);
			throw new Error(e);
		}
	}

	async create() {
		try {
			await this.createExchangeItem();

			await Promise.all([
				this.update(),
				this.createExpenseCategory(),
				this.createOperationCategory(),
			]);
		} catch (e) {
			console.warn("[RatesService / setExchangeSymbols]: ", e);
			throw new Error(e);
		}
	}

	async findAll(role: ERole = ERole.LVL3) {
		try {
			const sliceCount = roleRestrictions(role).getCurrencyCount();
			const whiteList = ["USD", "EUR", "RUB"];

			const requiredItemsData =
				await this.prismaService.exchangeItem.findMany({
					where: {
						value: { in: whiteList },
					},
					include: {
						label: {
							where: {
								lang: I18nContext.current().lang,
							},
							orderBy: {
								label: "asc",
							},
						},
					},
				});

			const exchange = await this.prismaService.exchangeItem.findMany({
				skip: 0,
				take: sliceCount,
				where: {
					value: { notIn: whiteList },
				},
				include: {
					label: {
						where: {
							lang: I18nContext.current().lang,
						},
						orderBy: {
							label: "asc",
						},
					},
				},
			});

			return [...requiredItemsData, ...exchange];
		} catch (e) {
			console.warn("[RatesService / getExchangeItems]: ", e);
			throw new Error(e);
		}
	}

	async findCurrent(req: Record<string, any>) {
		try {
			const data = [];
			const userCur: string = req.payload.exchange;
			const ratesLib = [
				{
					from: "USD",
					to: "EUR",
				},
				{
					from: "EUR",
					to: "USD",
				},
			];

			if (userCur) {
				ratesLib.push(
					{
						from: "EUR",
						to: userCur,
					},
					{
						from: "USD",
						to: userCur,
					}
				);
			}

			for (const r of ratesLib) {
				if (r.from !== r.to) {
					const convertedPrice = await this.convertPrice({
						from: r.from,
						to: r.to,
						price: 1,
					});
					data.push({
						curFrom: r.from || "",
						curTo: r.to || "",
						rate: convertedPrice || 0,
					});
				}
			}

			return data;
		} catch (e) {
			console.warn("[RatesService / findCurrent]: ", e);
			throw new Error(e);
		}
	}

	async convertPrice({ from, to, price }: ConvertRatesDto) {
		try {
			const res = await this.prismaService.exchangeItem.findMany({
				where: {
					value: { in: [from, to] },
				},
			});
			const toBase: number =
				res.find((r: ExchangeItem) => r.value === from)?.rate || 0;
			const fromBase: number =
				res.find((r: ExchangeItem) => r.value === to)?.rate || 0;

			const convertToBase: number = price / toBase;

			return +(convertToBase * fromBase).toFixed(2);
		} catch (e) {
			console.warn("[RatesService / convertPrice]: ", e);
			throw new Error(e);
		}
	}

	@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
	async update() {
		try {
			const res = await fetch(
				`${this.configService.get("CURRENCY_API")}latest?access_key=${this.configService.get("CONVERT_CURRENCY")}`
			);
			const data = await res.json();
			const symbolsArr = Object.entries(data.rates);

			for (const [key, val] of symbolsArr) {
				await this.prismaService.exchangeItem.update({
					where: {
						value: key,
					},
					data: {
						base: data.base?.toString() || "",
						rate: Number(val) || 0,
					},
				});
			}

			const options = {
				to: this.configService.get("EMAIL_SERVER_USER"),
				template: "updateRates",
				locale: "en",
			};

			await this.mailService.sendEmail(options);
		} catch (e) {
			console.warn("[RatesService / update]: ", e);
			throw new Error(e);
		}
	}
}
