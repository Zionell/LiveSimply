import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Patch,
	Post,
	Req,
	UsePipes,
	ValidationPipe,
} from "@nestjs/common";
import { type Request } from "express";
import { HealthProfileService } from "./health-profile.service";
import { CreateHealthProfileDto } from "./dto/create-health-profile.dto";
import { UpdateHealthProfileDto } from "./dto/update-health-profile.dto";

@Controller("health/profile")
@UsePipes(
	new ValidationPipe({
		transform: true,
		whitelist: true,
		forbidNonWhitelisted: true,
	})
)
export class HealthProfileController {
	constructor(private readonly healthProfileService: HealthProfileService) {}

	@Get()
	get(@Req() req: Request) {
		return this.healthProfileService.get(req);
	}

	@HttpCode(HttpStatus.CREATED)
	@Post()
	create(@Body() dto: CreateHealthProfileDto, @Req() req: Request) {
		return this.healthProfileService.create(dto, req);
	}

	@Patch()
	update(@Body() dto: UpdateHealthProfileDto, @Req() req: Request) {
		return this.healthProfileService.update(dto, req);
	}
}
