import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post,
	Query,
	Req,
	UsePipes,
	ValidationPipe,
} from "@nestjs/common";
import { type Request } from "express";
import { HealthBodyService } from "./health-body.service";
import { FindHealthRangeDto } from "./dto/find-health-range.dto";
import { UpsertBodyEntryDto } from "./dto/upsert-body-entry.dto";
import { UpdateBodyEntryDto } from "./dto/update-body-entry.dto";

@Controller("health/body")
@UsePipes(new ValidationPipe({ transform: true }))
export class HealthBodyController {
	constructor(private readonly healthBodyService: HealthBodyService) {}

	@Get()
	list(@Query() dto: FindHealthRangeDto, @Req() req: Request) {
		return this.healthBodyService.list(dto, req);
	}

	@HttpCode(HttpStatus.CREATED)
	@Post()
	upsert(@Body() dto: UpsertBodyEntryDto, @Req() req: Request) {
		return this.healthBodyService.upsert(dto, req);
	}

	@Patch(":id")
	update(
		@Param("id") id: string,
		@Body() dto: UpdateBodyEntryDto,
		@Req() req: Request
	) {
		return this.healthBodyService.update(id, dto, req);
	}

	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete(":id")
	async remove(@Param("id") id: string, @Req() req: Request) {
		await this.healthBodyService.remove(id, req);
		return;
	}
}
