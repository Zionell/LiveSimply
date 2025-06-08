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
	Query,
	UsePipes,
	ValidationPipe,
} from "@nestjs/common";
import { type Request } from "express";
import { FinanceService } from "./finance.service";
import { CreateFinanceDto } from "./dto/create-finance.dto";
import { UpdateFinanceDto } from "./dto/update-finance.dto";
import { AuthGuard } from "../auth/guards/auth.guard";
import { FindAllFinanceDto } from "./dto/find-all-finance.dto";

@Controller("finance")
export class FinanceController {
	constructor(private readonly financeService: FinanceService) {}

	@UseGuards(AuthGuard)
	@Get("specs")
	getSpecs(@Req() req: Request) {
		return this.financeService.getSpecs(req);
	}

	@UseGuards(AuthGuard)
	@Get("statistics")
	getStatistics(@Req() req: Request) {
		return this.financeService.getStatistics(req);
	}

	@UseGuards(AuthGuard)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UsePipes(new ValidationPipe({ transform: true }))
	async create(
		@Body() createFinanceDto: CreateFinanceDto,
		@Req() req: Request
	) {
		await this.financeService.create(createFinanceDto, req);
		return HttpStatus.CREATED;
	}

	@UseGuards(AuthGuard)
	@Get()
	findAll(@Query() dto: FindAllFinanceDto, @Req() req: Request) {
		return this.financeService.findAll(dto, req);
	}

	@UseGuards(AuthGuard)
	@Get(":id")
	findOne(@Param("id") id: string) {
		return this.financeService.findOne(id);
	}

	@UseGuards(AuthGuard)
	@Patch(":id")
	update(
		@Param("id") id: string,
		@Body() updateFinanceDto: UpdateFinanceDto
	) {
		return this.financeService.update(id, updateFinanceDto);
	}

	@UseGuards(AuthGuard)
	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete(":id")
	async remove(@Param("id") id: string) {
		await this.financeService.remove(id);
		return HttpStatus.NO_CONTENT;
	}
}
