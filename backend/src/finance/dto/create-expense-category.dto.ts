import { ApiProperty } from "@nestjs/swagger";
import { IsHexColor, IsOptional, IsString, Length } from "class-validator";
import { Transform } from "class-transformer";

export class CreateExpenseCategoryDto {
	@ApiProperty()
	@Transform(({ value }) =>
		typeof value === "string" ? value.trim() : value
	)
	@IsString()
	@Length(1, 30)
	label: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsHexColor()
	color?: string;
}
