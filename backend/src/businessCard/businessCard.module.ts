import { Module } from "@nestjs/common";
import { BusinessCardService } from "./businessCard.service";
import { BusinessCardController } from "./businessCard.controller";

@Module({
	controllers: [BusinessCardController],
	providers: [BusinessCardService],
})
export class BusinessCardModule {}
