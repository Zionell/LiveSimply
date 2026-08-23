import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class UpdateNotificationRatesDto {
	@ApiProperty()
	@IsString()
	@IsOptional()
	error?: string;

	@ApiProperty()
	@IsString()
	@IsOptional()
	errorMsg?: string;
}
