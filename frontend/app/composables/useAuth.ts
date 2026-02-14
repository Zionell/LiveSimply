import type { ProvidersType } from "#shared/types/auth";
import { api } from "~~/lib/api";

export default function useAuth() {
	async function loginBy(provider: ProvidersType) {
		try {
			const route = useRoute();
			const query = new URLSearchParams({
				redirectUrl: route.query.redirectUrl as string,
			});

			window.location.href = `${api.auth.provider(provider)}?${query.toString()}`;
		} catch (e) {
			console.error(`useAuth / loginBy-${provider}: `, e);
		}
	}

	async function signOut() {
		try {
			await useFetch(api.auth.logout);
			window.location.href = ERoutes.index;
		} catch (e) {
			console.error("useAuth / signOut: ", e);
		}
	}

	return {
		loginBy,
		signOut,
	};
}
