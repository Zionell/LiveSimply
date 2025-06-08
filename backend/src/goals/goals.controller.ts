import {
	Controller,
	Get,
	Post,
	Body,
	Patch,
	Param,
	Delete,
	UseGuards,
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
import { AuthGuard } from "../auth/guards/auth.guard";

@Controller("goals")
export class GoalsController {
	constructor(private readonly goalsService: GoalsService) {}

	@UseGuards(AuthGuard)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UsePipes(new ValidationPipe({ transform: true }))
	async create(@Body() dto: CreateGoalsDto, @Req() req: Request) {
		await this.goalsService.create(dto, req);
		return HttpStatus.CREATED;
	}

	@UseGuards(AuthGuard)
	@Get()
	findAll(@Req() req: Request) {
		return this.goalsService.findAll(req);
	}

	@UseGuards(AuthGuard)
	@Get(":id")
	findOne(@Param("id") id: string) {
		return this.goalsService.findOne(id);
	}

	@UseGuards(AuthGuard)
	@Patch(":id")
	update(@Param("id") id: string, @Body() dto: UpdateGoalsDto) {
		return this.goalsService.update(id, dto);
	}

	@UseGuards(AuthGuard)
	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete(":id")
	async remove(@Param("id") id: string) {
		await this.goalsService.remove(id);
		return HttpStatus.NO_CONTENT;
	}
}
