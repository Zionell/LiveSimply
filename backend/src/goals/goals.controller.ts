import {
	Controller,
	Get,
	Post,
	Body,
	Patch,
	Param,
	Delete,
	Req,
	HttpStatus,
	HttpCode,
	UsePipes,
	ValidationPipe,
} from "@nestjs/common";
import { type Request } from "express";
import { GoalsService } from "./goals.service";
import { CreateGoalsDto } from "./dto/create-goals.dto";
import { UpdateGoalsDto } from "./dto/update-goals.dto";

@Controller("goals")
export class GoalsController {
	constructor(private readonly goalsService: GoalsService) {}

	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UsePipes(new ValidationPipe({ transform: true }))
	async create(@Body() dto: CreateGoalsDto, @Req() req: Request) {
		await this.goalsService.create(dto, req);
		return HttpStatus.CREATED;
	}

	@Get()
	findAll(@Req() req: Request) {
		return this.goalsService.findAll(req);
	}

	@Get(":id")
	findOne(@Param("id") id: string) {
		return this.goalsService.findOne(id);
	}

	@Patch(":id")
	update(@Param("id") id: string, @Body() dto: UpdateGoalsDto) {
		return this.goalsService.update(id, dto);
	}

	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete(":id")
	async remove(@Param("id") id: string) {
		await this.goalsService.remove(id);
		return HttpStatus.NO_CONTENT;
	}
}
