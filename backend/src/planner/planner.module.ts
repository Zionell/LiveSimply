import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PlannerService } from "./planner.service";
import { PlannerController } from "./planner.controller";
import { PrismaService } from "../prisma.service";
import { RatesService } from "../rates/rates.service";
import { TranslateService } from "../translate/translate.service";
import { MailService } from "../mail/mail.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { BudgetAlertService } from "./budget-alert.service";

@Module({
	imports: [ConfigModule, NotificationsModule],
	controllers: [PlannerController],
	providers: [
		PlannerService,
		PrismaService,
		RatesService,
		TranslateService,
		MailService,
		BudgetAlertService,
	],
	exports: [PlannerService, BudgetAlertService],
})
export class PlannerModule {}
