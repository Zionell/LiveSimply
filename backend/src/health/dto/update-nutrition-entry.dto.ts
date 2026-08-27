import { ApiProperty } from "@nestjs/swagger";
import {
	IsNumber,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
} from "class-validator";

export class UpdateNutritionEntryDto {
	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(20000)
	targetKcal?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(2000)
	targetProteinG?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(2000)
	targetFatG?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(2000)
	targetCarbsG?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	note?: string;
}
