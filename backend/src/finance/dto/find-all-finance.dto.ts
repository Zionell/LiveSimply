import { ApiProperty } from "@nestjs/swagger";
import { IsNumber } from "class-validator";
import { Type } from "class-transformer";

export class FindAllFinanceDto {
	@ApiProperty({ required: false })
	@IsNumber()
	@Type(() => Number)
	limit: number;

	@ApiProperty({ required: false })
	@IsNumber()
	@Type(() => Number)
	offset: number;

	@ApiProperty({ required: false })
	sort: "desc" | "asc";
}
