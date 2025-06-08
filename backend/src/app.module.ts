import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaService } from "./prisma.service";
import configuration from "./config/configuration";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import * as path from "path";
import { CookieResolver, I18nModule } from "nestjs-i18n";
import { FinanceModule } from "./finance/finance.module";
import { TranslateModule } from "./translate/translate.module";
import { RatesModule } from "./rates/rates.module";
import { ScheduleModule } from "@nestjs/schedule";
import { BusinessCardModule } from "./businessCard/businessCard.module";
import { GoalsModule } from "./goals/goals.module";

@Module({
	imports: [
		ConfigModule.forRoot({
			envFilePath: ".env",
			load: [configuration],
		}),
		ThrottlerModule.forRoot([
			{
				ttl: 60000,
				limit: 10,
			},
		]),
		ScheduleModule.forRoot(),
		AuthModule,
		UsersModule,
		I18nModule.forRoot({
			fallbackLanguage: "en",
			loaderOptions: {
				path: path.join(__dirname, "/i18n/"),
				watch: true,
			},
			resolvers: [new CookieResolver(["i18n_redirected"])],
		}),
		FinanceModule,
		TranslateModule,
		RatesModule,
		BusinessCardModule,
		GoalsModule,
	],
	providers: [PrismaService],
})
export class AppModule {}
