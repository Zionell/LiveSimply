import { prefix } from "~~/lib/api";

export default defineEventHandler(async (event) => {
	const url = getRequestURL(event);

	if (!url.pathname.startsWith(prefix)) {
		return;
	}

	const config = useRuntimeConfig();
	const target = config.public.PROXY_URL;

	const proxyURL = new URL(url.href, target);

	return await proxyRequest(event, proxyURL.href);
});
