import { Controller, Get, Post, Patch, Body, Req } from "@nestjs/common";
import { RatesService } from "./rates.service";
import { ConvertRatesDto } from "./dto/convert-rates.dto";
import { PublicRoute } from "~/auth/decorators/public.decorator";

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

	@Patch()
	update() {
		return this.ratesService.update();
	}

	@Post("convert")
	convertPrice(@Body() dto: ConvertRatesDto) {
		return this.ratesService.convertPrice(dto);
	}
}
