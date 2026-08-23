import { Module } from "@nestjs/common";
import { FinanceService } from "./finance.service";
import { FinanceController } from "./finance.controller";
import { SpecsSerializer } from "./serializer/specs.serializer";
import { RatesModule } from "../rates/rates.module";
import { UsersModule } from "../users/users.module";
import { GoalsModule } from "../goals/goals.module";
import { PlannerModule } from "../planner/planner.module";

@Module({
	imports: [RatesModule, UsersModule, GoalsModule, PlannerModule],
	controllers: [FinanceController],
	providers: [SpecsSerializer, FinanceService],
})
export class FinanceModule {}
