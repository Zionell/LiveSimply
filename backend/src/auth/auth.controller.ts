import {
	Body,
	Controller,
	Post,
	HttpCode,
	HttpStatus,
	UseGuards,
	Get,
	Res,
	Req,
	UsePipes,
	ValidationPipe,
} from "@nestjs/common";
import { type Response } from "express";
import { AuthService } from "./auth.service";
import { LoginUserDto } from "./dto/login-user.dto";
import { AuthGuard } from "./guards/auth.guard";
import { ApiBody } from "@nestjs/swagger";

@Controller("auth")
export class AuthController {
	constructor(private authService: AuthService) {}

	@HttpCode(HttpStatus.OK)
	@Post("login")
	@ApiBody({ type: LoginUserDto })
	@UsePipes(new ValidationPipe({ transform: true }))
	async login(@Body() dto: LoginUserDto, @Res() response: Response) {
		const { token, ...res } = await this.authService.login(dto);

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
	@Get("profile")
	async getProfile(@Req() req, @Res() response: Response) {
		const { token, ...res } = await this.authService.getProfile(req);

		response
			.cookie("token", token, {
				sameSite: "none",
				secure: true,
				httpOnly: true,
			})
			.json({ ...res.user });
		return response;
	}

	@Post("logout")
	async logout(@Res() response: Response) {
		try {
			response.cookie("token", "");
			return response.status(HttpStatus.OK).end();
		} catch (e) {
			return e;
		}
	}
}
