import {
	Controller,
	Get,
	Post,
	Body,
	Patch,
	Param,
	Delete,
	UseGuards,
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
import { AuthGuard } from "../auth/guards/auth.guard";

@Controller("business-card")
export class BusinessCardController {
	constructor(private readonly businessCardService: BusinessCardService) {}

	@UseGuards(AuthGuard)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UsePipes(new ValidationPipe({ transform: true }))
	async create(@Body() dto: CreateBusinessCardDto, @Req() req: Request) {
		await this.businessCardService.create(dto, req);
		return HttpStatus.CREATED;
	}

	@UseGuards(AuthGuard)
	@Get()
	findOne(@Req() req: Request) {
		return this.businessCardService.findOne(req);
	}

	@Get(":id")
	findOneByID(@Param("id") id: string) {
		return this.businessCardService.findOneById(id);
	}

	@UseGuards(AuthGuard)
	@Patch(":id")
	update(@Param("id") id: string, @Body() dto: UpdateBusinessCardDto) {
		return this.businessCardService.update(id, dto);
	}

	@UseGuards(AuthGuard)
	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete(":id")
	async remove(@Param("id") id: string) {
		await this.businessCardService.remove(id);
		return HttpStatus.NO_CONTENT;
	}

	@UseGuards(AuthGuard)
	@Post("link")
	@UsePipes(new ValidationPipe({ transform: true }))
	async createLink(@Body() dto: CreateBusinessCardLinkDto) {
		return this.businessCardService.createLink(dto);
	}

	@UseGuards(AuthGuard)
	@Patch("link/:id")
	async updateLink(
		@Param("id") id: string,
		@Body() dto: UpdateBusinessCardLinkDto
	) {
		return this.businessCardService.updateLink(id, dto);
	}

	@UseGuards(AuthGuard)
	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete("link/:id")
	async removeLink(@Param("id") id: string) {
		await this.businessCardService.removeLink(id);
		return HttpStatus.NO_CONTENT;
	}
}
