import { IUser } from "@/types/user";

export interface ILoginResponse {
	token: string;
	user: IUser;
}
