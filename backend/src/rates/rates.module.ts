import { Module } from "@nestjs/common";
import { RatesService } from "./rates.service";
import { RatesController } from "./rates.controller";
import { PrismaService } from "~/prisma.service";
import { ConfigModule } from "@nestjs/config";
import { TranslateModule } from "~/translate/translate.module";
import { MailService } from "~/mail/mail.service";

@Module({
	imports: [ConfigModule, TranslateModule],
	controllers: [RatesController],
	providers: [RatesService, PrismaService, MailService],
})
export class RatesModule {}
