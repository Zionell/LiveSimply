import { PartialType } from "@nestjs/swagger";
import {
	CreateBusinessCardDto,
	CreateBusinessCardLinkDto,
} from "./create-business-card.dto";

export class UpdateBusinessCardLinkDto extends PartialType(
	CreateBusinessCardLinkDto
) {}

export class UpdateBusinessCardDto extends PartialType(CreateBusinessCardDto) {}
