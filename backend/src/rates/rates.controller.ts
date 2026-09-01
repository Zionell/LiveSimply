import { Controller, Get, Post, Patch, Body, Req } from "@nestjs/common";
import { RatesService } from "./rates.service";
import { ConvertRatesDto } from "./dto/convert-rates.dto";
import { PublicRoute } from "../auth/decorators/public.decorator";
import { CronRoute } from "../auth/decorators/cron.decorator";

@Controller("rates")
export class RatesController {
	constructor(private readonly ratesService: RatesService) {}

	@PublicRoute()
	@Post()
	create() {
		return this.ratesService.create();
	}

	@Get()
	findAll() {
		return this.ratesService.findAll();
	}

	@Get("current")
	findCurrent(@Req() req: Request) {
		return this.ratesService.findCurrent(req);
	}

	/**
	 * Вызывается внешним планировщиком (блок `crons` в vercel.json).
	 * GET — потому что Vercel Cron умеет только его.
	 */
	@CronRoute()
	@Get("cron/update")
	async updateByCron() {
		await this.ratesService.update();

		return { updatedAt: new Date().toISOString() };
	}

	@Patch()
	update() {
		return this.ratesService.update();
	}

	@Post("convert")
	convertPrice(@Body() dto: ConvertRatesDto) {
		return this.ratesService.convertPrice(dto);
	}
}
