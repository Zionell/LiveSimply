import {
	Controller,
	Get,
	Post,
	Body,
	Patch,
	Param,
	Delete,
	Req,
	HttpStatus,
	HttpCode,
	UsePipes,
	ValidationPipe,
} from "@nestjs/common";
import { type Request } from "express";
import { BusinessCardService } from "./businessCard.service";
import {
	CreateBusinessCardDto,
	CreateBusinessCardLinkDto,
} from "./dto/create-business-card.dto";
import {
	UpdateBusinessCardDto,
	UpdateBusinessCardLinkDto,
} from "./dto/update-business-card.dto";
import { PublicRoute } from "~/auth/decorators/public.decorator";

@Controller("business-card")
export class BusinessCardController {
	constructor(private readonly businessCardService: BusinessCardService) {}

	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UsePipes(new ValidationPipe({ transform: true }))
	async create(@Body() dto: CreateBusinessCardDto, @Req() req: Request) {
		await this.businessCardService.create(dto, req);
		return HttpStatus.CREATED;
	}

	@Get()
	findOne(@Req() req: Request) {
		return this.businessCardService.findOne(req);
	}

	@PublicRoute()
	@Get(":id")
	findOneByID(@Param("id") id: string) {
		return this.businessCardService.findOneById(id);
	}

	@Patch(":id")
	update(@Param("id") id: string, @Body() dto: UpdateBusinessCardDto) {
		return this.businessCardService.update(id, dto);
	}

	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete(":id")
	async remove(@Param("id") id: string) {
		await this.businessCardService.remove(id);
		return HttpStatus.NO_CONTENT;
	}

	@Post("link")
	@UsePipes(new ValidationPipe({ transform: true }))
	async createLink(@Body() dto: CreateBusinessCardLinkDto) {
		return this.businessCardService.createLink(dto);
	}

	@Patch("link/:id")
	async updateLink(
		@Param("id") id: string,
		@Body() dto: UpdateBusinessCardLinkDto
	) {
		return this.businessCardService.updateLink(id, dto);
	}

	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete("link/:id")
	async removeLink(@Param("id") id: string) {
		await this.businessCardService.removeLink(id);
		return HttpStatus.NO_CONTENT;
	}
}
