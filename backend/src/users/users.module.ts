import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { MailModule } from "../mail/mail.module";

@Module({
	imports: [
		ConfigModule,
		MailModule,
		JwtModule.registerAsync({
			imports: [ConfigModule],
			useFactory: (configService: ConfigService) => ({
				secret: configService.get<string>("MAGIC_LINK_SECRET"),
				signOptions: {
					expiresIn: "15min",
				},
			}),
			inject: [ConfigService],
		}),
	],
	providers: [UsersService],
	exports: [UsersService],
	controllers: [UsersController],
})
export class UsersModule {}
