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
	Query,
	UsePipes,
	ValidationPipe,
} from "@nestjs/common";
import { type Request } from "express";
import { FinanceService } from "./finance.service";
import { CreateFinanceDto } from "./dto/create-finance.dto";
import { CreateExpenseCategoryDto } from "./dto/create-expense-category.dto";
import { UpdateFinanceDto } from "./dto/update-finance.dto";
import { FindAllFinanceDto } from "./dto/find-all-finance.dto";

@Controller("finance")
export class FinanceController {
	constructor(private readonly financeService: FinanceService) {}

	@Get("specs")
	getSpecs(@Req() req: Request) {
		return this.financeService.getSpecs(req);
	}

	@Get("statistics")
	getStatistics(@Req() req: Request) {
		return this.financeService.getStatistics(req);
	}

	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UsePipes(new ValidationPipe({ transform: true }))
	async create(
		@Body() createFinanceDto: CreateFinanceDto,
		@Req() req: Request
	) {
		return this.financeService.create(createFinanceDto, req);
	}

	@HttpCode(HttpStatus.CREATED)
	@Post("expense-categories")
	@UsePipes(new ValidationPipe({ transform: true }))
	async createExpenseCategory(@Body() dto: CreateExpenseCategoryDto) {
		return this.financeService.createExpenseCategory(dto);
	}

	@Get()
	findAll(@Query() dto: FindAllFinanceDto, @Req() req: Request) {
		return this.financeService.findAll(dto, req);
	}

	@Get(":id")
	findOne(@Param("id") id: string) {
		return this.financeService.findOne(id);
	}

	@Patch(":id")
	update(
		@Param("id") id: string,
		@Body() updateFinanceDto: UpdateFinanceDto,
		@Req() req: Request
	) {
		return this.financeService.update(id, updateFinanceDto, req);
	}

	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete("reset")
	async reset(@Req() req: Request) {
		await this.financeService.resetAll(req);
		return HttpStatus.NO_CONTENT;
	}

	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete(":id")
	async remove(@Param("id") id: string, @Req() req: Request) {
		await this.financeService.remove(id, req);
		return HttpStatus.NO_CONTENT;
	}
}
