import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export class FindPlannerDto {
	@ApiProperty({ required: false })
	@IsOptional()
	@IsInt()
	@Min(2000)
	@Max(2100)
	@Type(() => Number)
	year?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(12)
	@Type(() => Number)
	month?: number;
}
