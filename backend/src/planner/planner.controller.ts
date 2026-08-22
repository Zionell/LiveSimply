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
import { PlannerService } from "./planner.service";
import { FindPlannerDto } from "./dto/find-planner.dto";
import { UpdatePlannerDto } from "./dto/update-planner.dto";
import { CreateBudgetItemDto } from "./dto/create-budget-item.dto";
import { UpdateBudgetItemDto } from "./dto/update-budget-item.dto";

@Controller("planner")
@UsePipes(new ValidationPipe({ transform: true }))
export class PlannerController {
	constructor(private readonly plannerService: PlannerService) {}

	@Get()
	getOrCreate(@Query() dto: FindPlannerDto, @Req() req: Request) {
		return this.plannerService.getOrCreate(dto, req);
	}

	@Patch(":id")
	update(
		@Param("id") id: string,
		@Body() dto: UpdatePlannerDto,
		@Req() req: Request
	) {
		return this.plannerService.update(id, dto, req);
	}

	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete(":id")
	async remove(@Param("id") id: string, @Req() req: Request) {
		await this.plannerService.remove(id, req);
		return HttpStatus.NO_CONTENT;
	}

	@HttpCode(HttpStatus.CREATED)
	@Post(":id/items")
	addItem(
		@Param("id") id: string,
		@Body() dto: CreateBudgetItemDto,
		@Req() req: Request
	) {
		return this.plannerService.addItem(id, dto, req);
	}

	@Patch("items/:itemId")
	updateItem(
		@Param("itemId") itemId: string,
		@Body() dto: UpdateBudgetItemDto,
		@Req() req: Request
	) {
		return this.plannerService.updateItem(itemId, dto, req);
	}

	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete("items/:itemId")
	async removeItem(@Param("itemId") itemId: string, @Req() req: Request) {
		await this.plannerService.removeItem(itemId, req);
		return HttpStatus.NO_CONTENT;
	}
}
