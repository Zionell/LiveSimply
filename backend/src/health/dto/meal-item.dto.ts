import { ApiProperty } from "@nestjs/swagger";
import { IsMongoId, IsNumber, Max, Min } from "class-validator";

export class MealItemDto {
	@ApiProperty()
	@IsMongoId()
	productId: string;

	@ApiProperty()
	@IsNumber()
	@Min(1)
	@Max(5000)
	grams: number;
}
