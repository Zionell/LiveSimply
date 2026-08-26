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

export class UpdateHealthProfileDto {
	@ApiProperty({ required: false, enum: EHealthSex })
	@IsOptional()
	@IsEnum(EHealthSex)
	sex?: EHealthSex;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsDateString()
	birthDate?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(50)
	@Max(260)
	heightCm?: number;

	@ApiProperty({ required: false, enum: EActivityLevel })
	@IsOptional()
	@IsEnum(EActivityLevel)
	activityLevel?: EActivityLevel;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(20)
	@Max(500)
	startWeightKg?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(20)
	@Max(500)
	targetWeightKg?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsDateString()
	startedAt?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(1500)
	dailyDeficit?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(0.5)
	@Max(4)
	proteinPerKg?: number;

	@ApiProperty({ required: false, enum: EProteinBasis })
	@IsOptional()
	@IsEnum(EProteinBasis)
	proteinBasis?: EProteinBasis;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(0.15)
	@Max(0.6)
	fatPercent?: number;
}
