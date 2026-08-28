import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsDateString,
	IsEnum,
	ValidateNested,
} from "class-validator";
import { EMealType } from "../../../types/health";
import { MealItemDto } from "./meal-item.dto";

export class CreateMealDto {
	@ApiProperty()
	@IsDateString()
	date: string;

	@ApiProperty({ enum: EMealType })
	@IsEnum(EMealType)
	mealType: EMealType;

	@ApiProperty({ type: [MealItemDto] })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(50)
	@ValidateNested({ each: true })
	@Type(() => MealItemDto)
	items: MealItemDto[];
}
