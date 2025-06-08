import { Module } from "@nestjs/common";
import { MailService } from "./mail.service";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma.service";
import { MailerModule } from "@nestjs-modules/mailer";
import { join } from "path";
import { PugAdapter } from "@nestjs-modules/mailer/dist/adapters/pug.adapter";

@Module({
	imports: [
		ConfigModule,
		MailerModule.forRootAsync({
			imports: [ConfigModule],
			useFactory: (configService: ConfigService) => ({
				transport: {
					host: configService.get("EMAIL_SERVER_HOST"),
					secure: true,
					auth: {
						user: configService.get("EMAIL_SERVER_USER"),
						pass: configService.get("EMAIL_SERVER_PASSWORD"),
					},
				},
				defaults: {
					from: configService.get("EMAIL_FROM"),
				},
				template: {
					dir: join(__dirname, "/templates/"),
					adapter: new PugAdapter(),
					options: {
						strict: true,
					},
				},
			}),
			inject: [ConfigService],
		}),
	],
	providers: [MailService, PrismaService],
})
export class MailModule {}
