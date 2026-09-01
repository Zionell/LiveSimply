import {
	CanActivate,
	ExecutionContext,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { timingSafeEqual } from "node:crypto";

/**
 * Пускает только внешний планировщик. Vercel Cron шлёт заголовок
 * `Authorization: Bearer $CRON_SECRET`, если переменная задана в проекте.
 */
@Injectable()
export class CronGuard implements CanActivate {
	constructor(private readonly configService: ConfigService) {}

	canActivate(context: ExecutionContext): boolean {
		const secret = this.configService.get<string>("CRON_SECRET");

		// Без секрета маршрут был бы открыт всему интернету, поэтому закрываемся.
		if (!secret) {
			throw new UnauthorizedException();
		}

		const request = context.switchToHttp().getRequest<Request>();
		const token = request.headers.authorization?.split(" ")?.[1];

		if (!token || !this.matches(token, secret)) {
			throw new UnauthorizedException();
		}

		return true;
	}

	private matches(token: string, secret: string): boolean {
		const given = Buffer.from(token);
		const expected = Buffer.from(secret);

		// timingSafeEqual падает на буферах разной длины, поэтому длину
		// сравниваем отдельно — она и так видна по размеру запроса.
		return (
			given.length === expected.length && timingSafeEqual(given, expected)
		);
	}
}
