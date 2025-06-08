import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsString } from "class-validator";

export class ConvertRatesDto {
	@ApiProperty()
	@IsString()
	from: string;

	@ApiProperty()
	@IsString()
	to: string;

	@ApiProperty()
	@IsNumber()
	price: number;
}
