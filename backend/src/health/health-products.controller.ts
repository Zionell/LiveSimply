import {
	Body,
	Controller,
	Get,
	Post,
	Query,
	Req,
	UsePipes,
	ValidationPipe,
} from "@nestjs/common";
import { type Request } from "express";
import { HealthProductsService } from "./health-products.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { FindProductsDto } from "./dto/find-products.dto";

@Controller("health/products")
@UsePipes(
	new ValidationPipe({
		transform: true,
		whitelist: true,
		forbidNonWhitelisted: true,
	})
)
export class HealthProductsController {
	constructor(
		private readonly healthProductsService: HealthProductsService
	) {}

	@Get()
	list(@Query() dto: FindProductsDto, @Req() req: Request) {
		return this.healthProductsService.list(dto, req);
	}

	@Post()
	create(@Body() dto: CreateProductDto, @Req() req: Request) {
		return this.healthProductsService.create(dto, req);
	}
}
