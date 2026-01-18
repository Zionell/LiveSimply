import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { PrismaService } from "~/prisma.service";
import { UsersController } from "./users.controller";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { MailService } from "~/mail/mail.service";
import { MailModule } from "~/mail/mail.module";

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
	providers: [UsersService, PrismaService, MailService],
	exports: [UsersService],
	controllers: [UsersController],
})
export class UsersModule {}
