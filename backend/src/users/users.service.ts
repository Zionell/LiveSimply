import {
	ConflictException,
	Injectable,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import bcrypt from "bcryptjs";
import { MailService } from "../mail/mail.service";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { ERole, IUser } from "../../types/user";
import { UpdateUserDto } from "./dto/update-user.dto";
import { User } from "../../generated/prisma/client";
import { OAuthProfile } from "../auth/oauth/oauth.types";
import { I18nContext } from "nestjs-i18n";
import { normalizeLanguage } from "../../utils/language";

@Injectable()
export class UsersService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly mailService: MailService,
		private readonly configService: ConfigService,
		private readonly jwtService: JwtService
	) {}

	private readonly saltOrRounds = 10;

	/**
	 * The language the browser asked this request in — the cookie the app sets,
	 * or the Accept-Language header when there is no cookie yet.
	 */
	private requestLanguage(): string {
		return normalizeLanguage(I18nContext.current()?.lang);
	}

	async findOrCreate(dto: OAuthProfile): Promise<User> {
		const isUserExist = await this.prismaService.user.findUnique({
			where: {
				email: dto.email,
			},
		});

		if (isUserExist) {
			return isUserExist;
		}

		return this.prismaService.user.create({
			data: {
				email: dto.email,
				name: dto.name,
				image: dto.avatar,
				emailVerified: true,
				language: this.requestLanguage(),
			},
		});
	}

	async create(dto: CreateUserDto): Promise<void> {
		const isUserExist = await this.prismaService.user.findUnique({
			where: {
				email: dto.email,
			},
		});

		if (isUserExist) {
			throw new ConflictException({
				message: "user_exist",
			});
		}

		const hash = await bcrypt.hash(dto.password, this.saltOrRounds);

		const newUser = await this.prismaService.user.create({
			data: {
				...dto,
				password: hash,
				language: this.requestLanguage(),
			},
		});

		await this.sendMagicLink(newUser);
	}

	async sendMagicLink(user: IUser) {
		const token = this.jwtService.sign({
			email: user.email,
		});

		const confirmationLink = `https://${this.configService.get("SITE_HOST")}/verify/?token=${token}`;

		const options = {
			to: user.email,
			template: "welcome",
			locale: normalizeLanguage(user.language),
			props: {
				name: user.name,
				confirmationLink: confirmationLink,
			},
		};

		await this.mailService.sendEmail(options);
	}

	async verifyEmail(token: string) {
		try {
			const verifiedPayload = await this.jwtService.verifyAsync(token, {
				secret: this.configService.get("MAGIC_LINK_SECRET"),
			});

			const isUserExist = await this.prismaService.user.update({
				where: {
					email: verifiedPayload.email,
				},
				data: {
					updatedAt: new Date(),
					emailVerified: true,
				},
			});

			if (!isUserExist) {
				throw new NotFoundException({
					message: "no_user",
				});
			}

			const payload = {
				role: isUserExist.role,
				email: isUserExist.email,
			};

			return {
				user: isUserExist,
				token: await this.jwtService.signAsync(payload),
			};
		} catch {
			throw new UnauthorizedException({
				message: "token_expired",
			});
		}
	}

	/**
	 * Accounts that predate the language column have none stored. Fill it in
	 * from the request the first time we see them rather than emailing every
	 * existing user in English forever.
	 */
	async ensureLanguage(user: User): Promise<User> {
		if (user.language) {
			return user;
		}

		const language = this.requestLanguage();

		try {
			return await this.prismaService.user.update({
				where: { id: user.id },
				data: { language },
			});
		} catch (e) {
			console.warn("[UsersService / ensureLanguage]: ", e);
			return { ...user, language };
		}
	}

	async findOneByEmail(email: string): Promise<User | null> {
		return this.prismaService.user.findUnique({
			where: { email },
		});
	}

	async findAll(req: Record<string, any>) {
		try {
			const isAdmin = req.payload.role === ERole.ADMIN;

			if (!isAdmin) {
				throw new UnauthorizedException();
			}

			return await this.prismaService.user.findMany({
				select: {
					id: true,
					name: true,
					email: true,
					exchange: true,
					role: true,
				},
			});
		} catch (e) {
			throw e;
		}
	}

	async update(dto: Partial<UpdateUserDto>, req: Record<string, any>) {
		try {
			const id: string = req.payload.id;

			const data: Record<string, any> = {
				updatedAt: new Date(),
				...dto,
			};

			if (dto.language !== undefined) {
				data.language = normalizeLanguage(dto.language);
			}

			return await this.prismaService.user.update({
				where: { id },
				data,
			});
		} catch (e) {
			throw e;
		}
	}

	async deleteUser(id: string) {
		try {
			await this.prismaService.user.delete({
				where: { id },
			});
		} catch (e) {
			throw e;
		}
	}
}
