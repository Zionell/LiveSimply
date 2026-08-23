import {
	Body,
	Controller,
	Get,
	Param,
	Patch,
	Req,
	HttpCode,
	HttpStatus,
	UsePipes,
	ValidationPipe,
} from "@nestjs/common";
import { type Request } from "express";
import { NotificationsService } from "./notifications.service";
import { UpdateNotificationSettingsDto } from "./dto/update-notification-settings.dto";

@Controller("notifications")
export class NotificationsController {
	constructor(private readonly notificationsService: NotificationsService) {}

	@Get("settings")
	getSettings(@Req() req: Request) {
		return this.notificationsService.getSettings(req);
	}

	@Patch("settings")
	@UsePipes(new ValidationPipe({ transform: true }))
	updateSettings(
		@Body() dto: UpdateNotificationSettingsDto,
		@Req() req: Request
	) {
		return this.notificationsService.updateSettings(dto, req);
	}

	@Get()
	findAll(@Req() req: Request) {
		return this.notificationsService.findAll(req);
	}

	@HttpCode(HttpStatus.NO_CONTENT)
	@Patch("read-all")
	async markAllRead(@Req() req: Request) {
		await this.notificationsService.markAllRead(req);
		return HttpStatus.NO_CONTENT;
	}

	@HttpCode(HttpStatus.NO_CONTENT)
	@Patch(":id/read")
	async markRead(@Param("id") id: string, @Req() req: Request) {
		await this.notificationsService.markRead(id, req);
		return HttpStatus.NO_CONTENT;
	}
}
