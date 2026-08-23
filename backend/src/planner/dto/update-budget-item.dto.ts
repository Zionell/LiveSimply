import { ApiProperty } from "@nestjs/swagger";
import {
	IsBoolean,
	IsNumber,
	IsOptional,
	IsString,
	Min,
} from "class-validator";

export class UpdateBudgetItemDto {
	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	label?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(0)
	curAmount?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	currencyFromId?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsBoolean()
	isRequired?: boolean;
}
