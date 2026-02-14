const exclude: string[] = ["/api"];

export default defineNuxtRouteMiddleware(async (to, from) => {
	const toPath: string = to.path;
	const fromPath: string = from.fullPath;
	const redirectUrl: string = from.query?.redirectUrl?.toString() || "";

	const isExcluded = exclude.find((ex) => toPath.includes(ex));

	if (isExcluded) {
		return;
	}

	const userStore = useUserStore();

	if (userStore.user && toPath === ERoutes.index) {
		return navigateTo(redirectUrl || ERoutes.dashboard);
	}

	if (!userStore.user && toPath !== ERoutes.index) {
		return navigateTo(`${ERoutes.index}?redirectUrl=${fromPath}`);
	}
});
