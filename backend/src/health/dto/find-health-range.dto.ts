import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsOptional } from "class-validator";

export class FindHealthRangeDto {
	@ApiProperty({ required: false })
	@IsOptional()
	@IsDateString()
	from?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsDateString()
	to?: string;
}
