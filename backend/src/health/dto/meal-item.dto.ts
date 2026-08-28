import { ApiProperty } from "@nestjs/swagger";
import {
	IsMongoId,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	MinLength,
	Validate,
	ValidateIf,
	ValidatorConstraint,
	ValidatorConstraintInterface,
} from "class-validator";

/**
 * У позиции ровно один источник КБЖУ: либо продукт из справочника, либо
 * набранные вручную значения. Присланные вместе они означают, что клиент не
 * определился, — тихо предпочесть один из них значило бы потерять данные
 * пользователя без единого следа.
 */
@ValidatorConstraint({ name: "mealItemSource", async: false })
export class MealItemSourceConstraint implements ValidatorConstraintInterface {
	validate(_: unknown, args: { object: Record<string, any> }): boolean {
		const item = args.object;

		return Boolean(item.productId) !== Boolean(item.title);
	}

	defaultMessage(): string {
		return "A meal item needs either productId or a manual title with its macros, not both";
	}
}

export class MealItemDto {
	@ApiProperty({ required: false })
	@IsOptional()
	@IsMongoId()
	@Validate(MealItemSourceConstraint)
	productId?: string;

	@ApiProperty({ required: false })
	@ValidateIf(item => !item.productId)
	@IsString()
	@MinLength(1)
	@MaxLength(100)
	title?: string;

	// Потолки те же, что у CreateProductDto: ручная позиция описывает продукт
	// ровно так же, просто не сохраняется в справочник.
	@ApiProperty({ required: false })
	@ValidateIf(item => !item.productId)
	@IsNumber()
	@Min(0)
	@Max(1000)
	kcalPer100?: number;

	@ApiProperty({ required: false })
	@ValidateIf(item => !item.productId)
	@IsNumber()
	@Min(0)
	@Max(100)
	proteinPer100?: number;

	@ApiProperty({ required: false })
	@ValidateIf(item => !item.productId)
	@IsNumber()
	@Min(0)
	@Max(100)
	fatPer100?: number;

	@ApiProperty({ required: false })
	@ValidateIf(item => !item.productId)
	@IsNumber()
	@Min(0)
	@Max(100)
	carbsPer100?: number;

	@ApiProperty()
	@IsNumber()
	@Min(1)
	@Max(5000)
	grams: number;
}
