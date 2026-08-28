import { Module } from "@nestjs/common";
import { HealthProfileService } from "./health-profile.service";
import { HealthProfileController } from "./health-profile.controller";
import { HealthBodyService } from "./health-body.service";
import { HealthBodyController } from "./health-body.controller";
import { HealthProductsService } from "./health-products.service";
import { HealthProductsController } from "./health-products.controller";
import { HealthNutritionService } from "./health-nutrition.service";
import { HealthNutritionController } from "./health-nutrition.controller";

@Module({
	controllers: [
		HealthProfileController,
		HealthBodyController,
		HealthProductsController,
		HealthNutritionController,
	],
	providers: [
		HealthProfileService,
		HealthBodyService,
		HealthProductsService,
		HealthNutritionService,
	],
	exports: [
		HealthProfileService,
		HealthBodyService,
		HealthProductsService,
		HealthNutritionService,
	],
})
export class HealthModule {}
