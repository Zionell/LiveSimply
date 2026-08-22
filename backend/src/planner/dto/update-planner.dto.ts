import { ApiProperty } from "@nestjs/swagger";
import {
	IsBoolean,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	Min,
} from "class-validator";

export class UpdatePlannerDto {
	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(0)
	curIncome?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	currencyFromId?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(0.01)
	@Max(1)
	alertThreshold?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsBoolean()
	isRegular?: boolean;
}
