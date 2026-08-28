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
import { HealthNutritionService } from "./health-nutrition.service";
import { FindNutritionDto } from "./dto/find-nutrition.dto";
import { CreateMealDto } from "./dto/create-meal.dto";
import { UpdateMealDto } from "./dto/update-meal.dto";
import { UpdateNutritionEntryDto } from "./dto/update-nutrition-entry.dto";
import { ApplyTargetsDto } from "./dto/apply-targets.dto";

@Controller("health/nutrition")
@UsePipes(
	new ValidationPipe({
		transform: true,
		whitelist: true,
		forbidNonWhitelisted: true,
	})
)
export class HealthNutritionController {
	constructor(
		private readonly healthNutritionService: HealthNutritionService
	) {}

	@Get()
	list(@Query() dto: FindNutritionDto, @Req() req: Request) {
		return this.healthNutritionService.list(dto, req);
	}

	@HttpCode(HttpStatus.CREATED)
	@Post("meals")
	createMeal(@Body() dto: CreateMealDto, @Req() req: Request) {
		return this.healthNutritionService.createMeal(dto, req);
	}

	@Patch("meals/:mealId")
	updateMeal(
		@Param("mealId") mealId: string,
		@Body() dto: UpdateMealDto,
		@Req() req: Request
	) {
		return this.healthNutritionService.updateMeal(mealId, dto, req);
	}

	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete("meals/:mealId")
	async removeMeal(
		@Param("mealId") mealId: string,
		@Req() req: Request
	) {
		await this.healthNutritionService.removeMeal(mealId, req);
		return;
	}

	@Post("apply-targets")
	applyTargets(@Body() dto: ApplyTargetsDto, @Req() req: Request) {
		return this.healthNutritionService.applyTargets(dto, req);
	}

	@Patch(":id")
	updateDay(
		@Param("id") id: string,
		@Body() dto: UpdateNutritionEntryDto,
		@Req() req: Request
	) {
		return this.healthNutritionService.updateDay(id, dto, req);
	}

	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete(":id")
	async removeDay(@Param("id") id: string, @Req() req: Request) {
		await this.healthNutritionService.removeDay(id, req);
		return;
	}
}
