import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsString } from "class-validator";

export class CreateGoalsDto {
	@ApiProperty()
	@IsString()
	title: string;

	@ApiProperty()
	untilAt: Date;

	@ApiProperty()
	@IsNumber()
	total: number;

	@ApiProperty()
	@IsNumber()
	amount: number;

	@ApiProperty()
	exchangeId: string;

	@ApiProperty()
	isCompleted: boolean;
}
