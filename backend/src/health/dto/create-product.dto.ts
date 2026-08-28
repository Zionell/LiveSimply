import { ApiProperty } from "@nestjs/swagger";
import {
	IsEnum,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	MinLength,
} from "class-validator";
import { EProductCategory } from "../../../types/health";

export class CreateProductDto {
	@ApiProperty()
	@IsString()
	@MinLength(1)
	@MaxLength(100)
	title: string;

	@ApiProperty({ required: false, enum: EProductCategory })
	@IsOptional()
	@IsEnum(EProductCategory)
	category?: EProductCategory;

	// Потолок в 1000 ккал — с запасом над чистым жиром (899 ккал/100 г);
	// всё, что выше, физически невозможно и означает опечатку.
	@ApiProperty()
	@IsNumber()
	@Min(0)
	@Max(1000)
	kcalPer100: number;

	@ApiProperty()
	@IsNumber()
	@Min(0)
	@Max(100)
	proteinPer100: number;

	@ApiProperty()
	@IsNumber()
	@Min(0)
	@Max(100)
	fatPer100: number;

	@ApiProperty()
	@IsNumber()
	@Min(0)
	@Max(100)
	carbsPer100: number;
}
