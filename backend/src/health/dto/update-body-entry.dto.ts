import { ApiProperty } from "@nestjs/swagger";
import {
	IsNumber,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
} from "class-validator";

export class UpdateBodyEntryDto {
	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(20)
	@Max(500)
	weightKg?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(10)
	@Max(300)
	chestCm?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(10)
	@Max(300)
	waistCm?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(10)
	@Max(300)
	armCm?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	note?: string;
}
