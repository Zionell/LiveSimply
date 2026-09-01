import { applyDecorators, UseGuards } from "@nestjs/common";
import { PublicRoute } from "./public.decorator";
import { CronGuard } from "../guards/cron.guard";

/**
 * Точка входа для внешнего планировщика. PublicRoute снимает проверку JWT —
 * у планировщика его нет, — а CronGuard вместо неё требует CRON_SECRET.
 */
export function CronRoute() {
	return applyDecorators(PublicRoute(), UseGuards(CronGuard));
}
