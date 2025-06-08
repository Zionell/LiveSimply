import { defineStore } from "pinia";
import { useUserStore } from "@/store/user.ts";

export const useMainStore = defineStore("main", () => {
	async function nuxtServerInit() {
		try {
			await Promise.all([useUserStore().fetchUser()]);
		} catch (e) {
			console.error("[nuxtServerInit]: ", e);
		}
	}

	return {
		nuxtServerInit,
	};
});
