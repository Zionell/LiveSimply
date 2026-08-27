import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { EProductCategory } from "../../../types/health";

export class FindProductsDto {
	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	search?: string;

	@ApiProperty({ required: false, enum: EProductCategory })
	@IsOptional()
	@IsEnum(EProductCategory)
	category?: EProductCategory;
}
