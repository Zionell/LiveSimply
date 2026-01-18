import { Module } from "@nestjs/common";
import { BusinessCardService } from "./businessCard.service";
import { BusinessCardController } from "./businessCard.controller";
import { PrismaService } from "~/prisma.service";

@Module({
	controllers: [BusinessCardController],
	providers: [BusinessCardService, PrismaService],
})
export class BusinessCardModule {}
