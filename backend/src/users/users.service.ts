import {
	ConflictException,
	Injectable,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "~/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import bcrypt from "bcryptjs";
import { MailService } from "~/mail/mail.service";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { ERole, IUser } from "@/types/user";
import { UpdateUserDto } from "./dto/update-user.dto";
import { User } from "@/generated/prisma/client";

@Injectable()
export class UsersService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly mailService: MailService,
		private readonly configService: ConfigService,
		private readonly jwtService: JwtService
	) {}

	private readonly saltOrRounds = 10;

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
			locale: "en",
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

	async findOneByEmail(email: string): Promise<User | null> {
		return this.prismaService.user.findUnique({
			where: { email },
		});
	}

	async findAll(req: Record<string, any>) {
		try {
			console.log("req", req);
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

			return await this.prismaService.user.update({
				where: { id },
				data: {
					...dto,
				},
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
