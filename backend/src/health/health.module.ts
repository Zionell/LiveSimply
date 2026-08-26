import { Module } from "@nestjs/common";
import { HealthProfileService } from "./health-profile.service";
import { HealthProfileController } from "./health-profile.controller";
import { HealthBodyService } from "./health-body.service";
import { HealthBodyController } from "./health-body.controller";

@Module({
	controllers: [HealthProfileController, HealthBodyController],
	providers: [HealthProfileService, HealthBodyService],
	exports: [HealthProfileService, HealthBodyService],
})
export class HealthModule {}
