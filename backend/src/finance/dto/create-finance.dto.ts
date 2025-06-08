import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class CreateFinanceDto {
	@ApiProperty()
	curPrice: number;

	@ApiProperty()
	@IsString()
	currencyFromId: string;

	@ApiProperty()
	@IsString()
	operationCategoryId: string;

	@ApiProperty({ required: false })
	@IsString()
	@IsOptional()
	expenseCategoryId?: string | null;

	@ApiProperty({ required: false })
	@IsString()
	@IsOptional()
	goalsId?: string;
}
