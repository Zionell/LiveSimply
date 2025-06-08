import {
	CanActivate,
	ExecutionContext,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma.service";

@Injectable()
export class AuthGuard implements CanActivate {
	constructor(
		private readonly jwtService: JwtService,
		private readonly configService: ConfigService,
		private readonly prismaService: PrismaService
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const token = this.extractToken(request);

		if (!token) {
			throw new UnauthorizedException();
		}
		try {
			const payload = await this.jwtService.verifyAsync(token, {
				secret: this.configService.get<string>("JWT_SECRET"),
			});

			request["payload"] = await this.prismaService.user.findUnique({
				where: {
					email: payload.email,
				},
				select: {
					id: true,
					email: true,
					role: true,
					exchange: true,
					total: true,
				},
			});
		} catch {
			throw new UnauthorizedException();
		}
		return true;
	}

	private extractToken(request: Request): string | undefined {
		const token = request.cookies;
		return token?.token ?? undefined;
	}
}
