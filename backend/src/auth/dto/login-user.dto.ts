import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString } from "class-validator";
// import { errorsCodes } from "../constants";

export class LoginUserDto {
	@ApiProperty()
	@IsEmail()
	email: string;

	@ApiProperty()
	@IsString()
	password: string;
}
