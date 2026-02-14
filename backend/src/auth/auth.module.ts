import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { UsersModule } from "~/users/users.module";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PrismaService } from "~/prisma.service";
import { JwtModule } from "@nestjs/jwt";
import { OAuthModule } from "~/auth/oauth/oauth.module";

@Module({
	imports: [
		ConfigModule,
		UsersModule,
		JwtModule.registerAsync({
			imports: [ConfigModule],
			useFactory: (configService: ConfigService) => ({
				secret: configService.get<string>("JWT_SECRET"),
				signOptions: {
					expiresIn: configService.get<number>("JWT_EXPIRES_IN"),
				},
			}),
			inject: [ConfigService],
		}),
		OAuthModule,
	],
	providers: [AuthService, PrismaService],
	controllers: [AuthController],
})
export class AuthModule {}
