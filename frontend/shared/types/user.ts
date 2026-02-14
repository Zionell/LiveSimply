export enum ERole {
	ADMIN = "ADMIN",
	LVL1 = "LVL1",
	LVL2 = "LVL2",
	LVL3 = "LVL3",
	TEST = "TEST",
}

export interface IUser {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image: string | null;
	phone: string | null;
	exchange: string | null;
	role: ERole;
	total: number | null;
	createdAt: string;
	updatedAt: string;
}
