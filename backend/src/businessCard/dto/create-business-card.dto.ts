import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class CreateBusinessCardLinkDto {
	@ApiProperty()
	cardId: string;

	@ApiProperty()
	name: string;

	@ApiProperty()
	@IsOptional()
	icon?: string;

	@ApiProperty()
	link: string;

	@ApiProperty()
	isVisible: boolean;
}

export class CreateBusinessCardDto {
	@ApiProperty()
	@IsString()
	subtitle: string;

	@ApiProperty()
	@IsString()
	description: string;
}
