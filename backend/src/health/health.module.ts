import { Module } from "@nestjs/common";
import { HealthProfileService } from "./health-profile.service";
import { HealthProfileController } from "./health-profile.controller";
import { HealthBodyService } from "./health-body.service";
import { HealthBodyController } from "./health-body.controller";
import { HealthProductsService } from "./health-products.service";
import { HealthProductsController } from "./health-products.controller";

@Module({
	controllers: [
		HealthProfileController,
		HealthBodyController,
		HealthProductsController,
	],
	providers: [HealthProfileService, HealthBodyService, HealthProductsService],
	exports: [HealthProfileService, HealthBodyService, HealthProductsService],
})
export class HealthModule {}
