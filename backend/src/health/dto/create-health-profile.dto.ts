import { ApiProperty } from "@nestjs/swagger";
import {
	IsDateString,
	IsEnum,
	IsInt,
	IsNumber,
	IsOptional,
	Max,
	Min,
} from "class-validator";
import {
	EActivityLevel,
	EHealthSex,
	EProteinBasis,
} from "../../../types/health";

export class CreateHealthProfileDto {
	@ApiProperty({ enum: EHealthSex })
	@IsEnum(EHealthSex)
	sex: EHealthSex;

	@ApiProperty()
	@IsDateString()
	birthDate: string;

	@ApiProperty()
	@IsNumber()
	@Min(50)
	@Max(260)
	heightCm: number;

	@ApiProperty({ enum: EActivityLevel })
	@IsEnum(EActivityLevel)
	activityLevel: EActivityLevel;

	@ApiProperty()
	@IsNumber()
	@Min(20)
	@Max(500)
	startWeightKg: number;

	@ApiProperty()
	@IsNumber()
	@Min(20)
	@Max(500)
	targetWeightKg: number;

	@ApiProperty()
	@IsDateString()
	startedAt: string;

	@ApiProperty({ required: false, default: 500 })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(1500)
	dailyDeficit?: number;

	@ApiProperty({ required: false, default: 1.8 })
	@IsOptional()
	@IsNumber()
	@Min(0.5)
	@Max(4)
	proteinPerKg?: number;

	@ApiProperty({ required: false, enum: EProteinBasis })
	@IsOptional()
	@IsEnum(EProteinBasis)
	proteinBasis?: EProteinBasis;

	@ApiProperty({ required: false, default: 0.3 })
	@IsOptional()
	@IsNumber()
	@Min(0.15)
	@Max(0.6)
	fatPercent?: number;
}
