import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsIn } from "class-validator";
import { AVAILABLE_GROUPS, ENotificationGroup } from "../types";

export class UpdateNotificationSettingsDto {
	@ApiProperty({ enum: AVAILABLE_GROUPS })
	@IsIn(AVAILABLE_GROUPS)
	group: ENotificationGroup;

	@ApiProperty()
	@IsBoolean()
	isEmailEnabled: boolean;
}
