import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional } from "class-validator";
import { Type } from "class-transformer";

export class FindAllFinanceDto {
	@ApiProperty({ required: false })
	@IsOptional()
	@IsInt()
	@Type(() => Number)
	limit: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsInt()
	@Type(() => Number)
	offset: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsIn(["asc", "desc"])
	sort: "desc" | "asc";
}
