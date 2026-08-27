import {
	Controller,
	Get,
	Query,
	UsePipes,
	ValidationPipe,
} from "@nestjs/common";
import { HealthProductsService } from "./health-products.service";
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
	list(@Query() dto: FindProductsDto) {
		return this.healthProductsService.list(dto);
	}
}
