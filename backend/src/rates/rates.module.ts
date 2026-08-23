import { Module } from "@nestjs/common";
import { RatesService } from "./rates.service";
import { RatesController } from "./rates.controller";
import { ConfigModule } from "@nestjs/config";
import { TranslateModule } from "../translate/translate.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
	imports: [ConfigModule, TranslateModule, NotificationsModule],
	controllers: [RatesController],
	providers: [RatesService],
	exports: [RatesService],
})
export class RatesModule {}
