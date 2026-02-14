import type { IUser } from "@/types/user.ts";

export interface IBusinessCardLink {
	id: string;
	cardId: string;
	name: string;
	icon: string | null;
	link: string;
	isVisible: boolean;
}

export interface IBusinessCard {
	id: string;
	userId: string;
	subtitle: string;
	description: string;
	socialLinks: IBusinessCardLink[];
}

export interface IBusinessCardDetail {
	id: string;
	userId: string;
	subtitle: string;
	description: string;
	socialLinks: IBusinessCardLink[];
	user: Pick<IUser, "name" | "email" | "phone" | "image">;
}
