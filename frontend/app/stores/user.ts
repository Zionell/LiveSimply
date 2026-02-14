import { defineStore } from "pinia";
import { api } from "~~/lib/api";

export interface IUserStore {
	user: IUser | null;
}

export type TUserUpdate = Partial<IUser>;

export const useUserStore = defineStore("user", () => {
	const state = reactive<IUserStore>({
		user: null,
	});

	async function fetchUser() {
		try {
			const { data } = await useFetch<IUser>(api.auth.profile);

			if (data.value) {
				state.user = data.value;
			}
		} catch (e) {
			console.warn("fetchUser: ", e);
		}
	}

	async function updateUser(values: TUserUpdate) {
		try {
			const { data, error } = await useFetch<IUser>(api.users.common, {
				method: "PATCH",
				body: JSON.stringify(values),
			});

			if (error.value) {
				throw error.value;
			}

			if (data.value) {
				state.user = {
					...state.user,
					...data.value,
				};
			}
		} catch (e) {
			throw e;
		}
	}

	async function signOut() {
		try {
			await $fetch<IUser>(api.auth.logout);

			state.user = null;
			window.location.reload();
		} catch (e) {
			return e;
		}
	}

	return {
		...toRefs(state),
		fetchUser,
		updateUser,
		signOut,
	};
});
