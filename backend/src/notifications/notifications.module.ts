import { Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { PrismaService } from "../prisma.service";
import { MailService } from "../mail/mail.service";

@Module({
	controllers: [NotificationsController],
	providers: [NotificationsService, PrismaService, MailService],
	exports: [NotificationsService],
})
export class NotificationsModule {}
