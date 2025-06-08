import { Role } from "@prisma/client";

export interface IUser {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image: string | null;
	phone: string | null;
	exchange: string | null;
	role: Role;
	total: number | null;
}
