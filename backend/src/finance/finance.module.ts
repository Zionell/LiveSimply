import { Module } from "@nestjs/common";
import { FinanceService } from "./finance.service";
import { FinanceController } from "./finance.controller";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PrismaService } from "../prisma.service";
import { RatesService } from "../rates/rates.service";
import { TranslateService } from "../translate/translate.service";
import { MailService } from "../mail/mail.service";
import { SpecsSerializer } from "./serializer/specs.serializer";
import { UsersService } from "../users/users.service";
import { GoalsService } from "../goals/goals.service";

@Module({
	imports: [
		ConfigModule,
		JwtModule.registerAsync({
			imports: [ConfigModule],
			useFactory: (configService: ConfigService) => ({
				secret: configService.get<string>("JWT_SECRET"),
				signOptions: {
					expiresIn: configService.get<string>("JWT_EXPIRES_IN"),
				},
			}),
			inject: [ConfigService],
		}),
	],
	controllers: [FinanceController],
	providers: [
		SpecsSerializer,
		FinanceService,
		PrismaService,
		RatesService,
		TranslateService,
		MailService,
		UsersService,
		GoalsService,
	],
})
export class FinanceModule {}
