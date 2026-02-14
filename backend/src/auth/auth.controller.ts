import {
	Body,
	Controller,
	Post,
	HttpCode,
	HttpStatus,
	Get,
	Res,
	Req,
	UsePipes,
	ValidationPipe,
	Param,
	Query,
} from "@nestjs/common";
import { type Response } from "express";
import { AuthService } from "./auth.service";
import { LoginUserDto } from "./dto/login-user.dto";
import { ApiBody } from "@nestjs/swagger";
import { PublicRoute } from "~/auth/decorators/public.decorator";
import { OAuthService } from "~/auth/oauth/oauth.service";

let redirectTo = "";

@Controller("auth")
export class AuthController {
	constructor(
		private authService: AuthService,
		private oauthService: OAuthService
	) {}

	@PublicRoute()
	@HttpCode(HttpStatus.OK)
	@Post("login")
	@ApiBody({ type: LoginUserDto })
	@UsePipes(new ValidationPipe({ transform: true }))
	async login(@Body() dto: LoginUserDto, @Res() response: Response) {
		const { token, ...res } = await this.authService.login(dto);

		response
			.cookie("token", token, {
				sameSite: "lax",
				secure: true,
				httpOnly: true,
			})
			.json({ ...res.user });
		return response;
	}

	@Get("logout")
	async logout(@Res() response: Response) {
		try {
			response.cookie("token", "");
			return response.status(HttpStatus.OK).end();
		} catch (e) {
			return e;
		}
	}

	@Get("profile")
	async getProfile(@Req() req: Request, @Res() response: Response) {
		const { token, ...res } = await this.authService.getProfile(req);

		response
			.cookie("token", token, {
				sameSite: "lax",
				secure: true,
				httpOnly: true,
			})
			.json({ ...res.user });
		return response;
	}

	@PublicRoute()
	@HttpCode(HttpStatus.OK)
	@Get(":provider")
	async loginBy(
		@Param("provider") provider: string,
		@Query("redirectUrl") redirectUrl: string,
		@Res() response: Response
	) {
		const state = crypto.randomUUID();
		const url = this.oauthService.getProvider(provider).getAuthUrl(state);
		redirectTo = redirectUrl;

		response.redirect(url);
	}

	@PublicRoute()
	@HttpCode(HttpStatus.OK)
	@Get(":provider/callback")
	async callback(
		@Param("provider") provider: string,
		@Query("code") code: string,
		@Res() response: Response
	) {
		const p = this.oauthService.getProvider(provider);

		const { accessToken } = await p.getToken(code);
		const profile = await p.getProfile(accessToken);
		const { token } = await this.authService.oauthLogin(profile);

		response
			.cookie("token", token, {
				sameSite: "lax",
				secure: true,
				httpOnly: true,
			})
			.redirect(`${process.env.FRONTEND_URL}${redirectTo}`);
		return response;
	}
}
