import {
	Controller,
	Post,
	Body,
	HttpCode,
	HttpStatus,
	UsePipes,
	ValidationPipe,
	Res,
	UseGuards,
	Get,
	Req,
	Patch,
	Delete,
	Param,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import type { Response } from "express";
import { AuthGuard } from "../auth/guards/auth.guard";
import { UpdateUserDto } from "./dto/update-user.dto";

@Controller("users")
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UsePipes(new ValidationPipe({ transform: true }))
	async create(@Body() dto: CreateUserDto) {
		await this.usersService.create(dto);
		return HttpStatus.CREATED;
	}

	@Post("verify")
	async verifyEmail(
		@Body() body: { token: string },
		@Res() response: Response
	) {
		const { token, ...res } = await this.usersService.verifyEmail(
			body.token
		);

		response
			.cookie("token", token, {
				sameSite: "none",
				secure: true,
				httpOnly: true,
			})
			.json({ ...res.user });
		return response;
	}

	@UseGuards(AuthGuard)
	@Get()
	findAll(@Req() req: Request) {
		return this.usersService.findAll(req);
	}

	@UseGuards(AuthGuard)
	@Patch()
	@UsePipes(new ValidationPipe({ transform: true }))
	update(@Body() dto: Partial<UpdateUserDto>, @Req() req: Request) {
		return this.usersService.update(dto, req);
	}

	@UseGuards(AuthGuard)
	@Delete(":id")
	@HttpCode(HttpStatus.NO_CONTENT)
	async deleteUser(@Param("id") id: string, @Res() res: Response) {
		await this.usersService.deleteUser(id);

		return res.status(HttpStatus.NO_CONTENT).send();
	}
}
