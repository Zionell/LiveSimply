interface IRobots {
	blockAiBots: boolean;
	blockNonSeoBots: boolean;
	userAgent: string;
	disallow: string[];
	allow: string[];
	sitemap: string;
	host: string;
}

export default function getRobotsInfo(): IRobots {
	const host: string = import.meta.env.SITE_URL || "http://localhost:3000";

	const disallow: string[] = ["/account", "/users"];

	const allow: string[] = ["/*.css", "/*.js", "/*.png", "/*.jpg"];

	return {
		blockAiBots: true,
		blockNonSeoBots: true,
		userAgent: "*",
		disallow: disallow,
		allow: allow,
		host: host,
		sitemap: `${host}sitemap.xml`,
	};
}
