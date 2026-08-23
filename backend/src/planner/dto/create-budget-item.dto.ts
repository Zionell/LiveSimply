import { ApiProperty } from "@nestjs/swagger";
import {
	IsBoolean,
	IsNumber,
	IsOptional,
	IsString,
	Min,
} from "class-validator";

export class CreateBudgetItemDto {
	@ApiProperty()
	@IsString()
	label: string;

	@ApiProperty()
	@IsNumber()
	@Min(0)
	curAmount: number;

	@ApiProperty()
	@IsString()
	currencyFromId: string;

	@ApiProperty()
	@IsString()
	expenseCategoryId: string;

	@ApiProperty({ required: false, default: false })
	@IsOptional()
	@IsBoolean()
	isRequired?: boolean;
}
