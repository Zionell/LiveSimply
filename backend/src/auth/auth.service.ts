import {
	Injectable,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
import bcrypt from "bcryptjs";
import { UsersService } from "~/users/users.service";
import { LoginUserDto } from "./dto/login-user.dto";
import { JwtService } from "@nestjs/jwt";
import { ILoginResponse } from "./types";
import { OAuthProfile } from "~/auth/oauth/oauth.types";

@Injectable()
export class AuthService {
	constructor(
		private usersService: UsersService,
		private jwtService: JwtService
	) {}

	async oauthLogin(dto: OAuthProfile): Promise<ILoginResponse> {
		const user = await this.usersService.findOrCreate(dto);

		const payload = { role: user.role, email: user.email };

		return {
			user,
			token: await this.jwtService.signAsync(payload),
		};
	}

	async login(dto: LoginUserDto): Promise<ILoginResponse> {
		const user = await this.usersService.findOneByEmail(dto.email);

		if (!user) {
			throw new NotFoundException({
				message: "no_user",
			});
		}

		const { password, ...result } = user;
		const isPassValid = await bcrypt.compare(dto.password, password);

		if (!isPassValid) {
			throw new UnauthorizedException();
		}

		const payload = { role: user.role, email: result.email };

		return {
			user: result,
			token: await this.jwtService.signAsync(payload),
		};
	}

	async getProfile(req: Record<string, any>): Promise<ILoginResponse> {
		if (!req?.payload) {
			throw new UnauthorizedException();
		}

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { password, ...user } = await this.usersService.findOneByEmail(
			req.payload.email
		);

		const payload = { role: user.role, email: user.email };

		return {
			user: user,
			token: await this.jwtService.signAsync(payload),
		};
	}
}
