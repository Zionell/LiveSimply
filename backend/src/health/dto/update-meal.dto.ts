import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsEnum,
	IsOptional,
	ValidateNested,
} from "class-validator";
import { EMealType } from "../../../types/health";
import { MealItemDto } from "./meal-item.dto";

export class UpdateMealDto {
	@ApiProperty({ required: false, enum: EMealType })
	@IsOptional()
	@IsEnum(EMealType)
	mealType?: EMealType;

	@ApiProperty({ required: false, type: [MealItemDto] })
	@IsOptional()
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(50)
	@ValidateNested({ each: true })
	@Type(() => MealItemDto)
	items?: MealItemDto[];
}
