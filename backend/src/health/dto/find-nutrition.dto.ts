import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsOptional } from "class-validator";
import { EGranularity } from "../../../types/health";

export class FindNutritionDto {
	@ApiProperty({ required: false })
	@IsOptional()
	@IsDateString()
	from?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsDateString()
	to?: string;

	@ApiProperty({ required: false, enum: EGranularity })
	@IsOptional()
	@IsEnum(EGranularity)
	granularity?: EGranularity;
}
