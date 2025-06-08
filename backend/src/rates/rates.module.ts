import { Module } from "@nestjs/common";
import { RatesService } from "./rates.service";
import { RatesController } from "./rates.controller";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma.service";
import { TranslateModule } from "../translate/translate.module";
import { MailService } from "../mail/mail.service";
import { JwtModule } from "@nestjs/jwt";

@Module({
	imports: [
		ConfigModule,
		TranslateModule,
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
	controllers: [RatesController],
	providers: [RatesService, PrismaService, MailService],
})
export class RatesModule {}
