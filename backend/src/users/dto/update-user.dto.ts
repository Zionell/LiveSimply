import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";
import { CreateUserDto } from "./create-user.dto";

export class UpdateUserDto extends CreateUserDto {
	@ApiProperty()
	total: number;

	@ApiProperty()
	exchange: string;

	@ApiProperty()
	image: string;

	@ApiProperty()
	phone: string;

	@ApiProperty()
	@IsString()
	password: string;
}
