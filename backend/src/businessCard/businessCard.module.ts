import { Module } from "@nestjs/common";
import { BusinessCardService } from "./businessCard.service";
import { BusinessCardController } from "./businessCard.controller";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PrismaService } from "../prisma.service";

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
	controllers: [BusinessCardController],
	providers: [BusinessCardService, PrismaService],
})
export class BusinessCardModule {}
