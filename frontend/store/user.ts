import { defineStore } from "pinia";
import type { IUser } from "@/types/user.ts";
import { api } from "@/lib/api.ts";

export interface IUserStore {
	user: IUser | null;
}

export type TUserUpdate = Partial<IUser>;

export const useUserStore = defineStore("user", () => {
	const state = reactive<IUserStore>({
		user: null,
	});

	async function loginUser(userData: Record<string, string>) {
		const { data: user, error } = await useFetch<IUser>(api.auth.login, {
			method: "POST",
			body: JSON.stringify(userData),
		});

		if (user.value) {
			state.user = user.value;
		}

		if (error.value) {
			throw error.value;
		}
	}

	async function registerUser(userData: Record<string, string>) {
		const { error } = await useFetch<IUser>(api.users.common, {
			method: "POST",
			body: JSON.stringify(userData),
		});

		if (error.value) {
			throw error.value;
		}
	}

	async function fetchUser() {
		const { data: user, error } = await useFetch<IUser>(api.auth.profile);

		if (error.value) {
			throw error.value;
		}

		if (user.value) {
			state.user = user.value;
		}
	}

	async function updateUser(values: TUserUpdate) {
		const { data: user, error } = await useFetch<IUser>(api.users.common, {
			method: "PATCH",
			body: JSON.stringify(values),
		});

		if (error.value) {
			throw error.value;
		}

		if (user.value) {
			state.user = {
				...state.user,
				...user.value,
			};
		}
	}

	async function signOut() {
		const { error } = await useFetch<IUser>(api.auth.logout, {
			method: "POST",
		});

		if (error.value) {
			throw error.value;
		} else {
			state.user = null;
			window.location.reload();
		}
	}

	return {
		...toRefs(state),
		loginUser,
		registerUser,
		fetchUser,
		updateUser,
		signOut,
	};
});
