import {
	Controller,
	Get,
	Post,
	Patch,
	Body,
	UseGuards,
	Req,
} from "@nestjs/common";
import { RatesService } from "./rates.service";
import { ConvertRatesDto } from "./dto/convert-rates.dto";
import { AuthGuard } from "../auth/guards/auth.guard";

@Controller("rates")
export class RatesController {
	constructor(private readonly ratesService: RatesService) {}

	@UseGuards(AuthGuard)
	@Post()
	create() {
		return this.ratesService.create();
	}

	@UseGuards(AuthGuard)
	@Get()
	findAll() {
		return this.ratesService.findAll();
	}

	@UseGuards(AuthGuard)
	@Get("current")
	findCurrent(@Req() req: Request) {
		return this.ratesService.findCurrent(req);
	}

	@UseGuards(AuthGuard)
	@Patch()
	update() {
		return this.ratesService.update();
	}

	@UseGuards(AuthGuard)
	@Post("convert")
	convertPrice(@Body() dto: ConvertRatesDto) {
		return this.ratesService.convertPrice(dto);
	}
}
