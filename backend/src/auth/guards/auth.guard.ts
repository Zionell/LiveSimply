import {
	CanActivate,
	ExecutionContext,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "~/prisma.service";
import { IS_PUBLIC_KEY } from "~/auth/decorators/public.decorator";
import { Reflector } from "@nestjs/core";

@Injectable()
export class AuthGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly jwtService: JwtService,
		private readonly configService: ConfigService,
		private readonly prismaService: PrismaService
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const token = this.extractToken(request);

		const isPublic = this.reflector.getAllAndOverride<boolean>(
			IS_PUBLIC_KEY,
			[context.getHandler(), context.getClass()]
		);

		if (isPublic) {
			return true;
		}

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
		const cookies = request.cookies;
		const authorization = request.headers.authorization;
		const token = authorization?.split(" ")?.[1] || cookies?.token;

		return token ?? undefined;
	}
}
