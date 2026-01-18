import getRobotsInfo from "./config/robots.ts";
import headConfig from "./config/head.config.ts";

interface IEnv {
	PROXY_URL: string;
	SITE_URL: string;
	DEV: boolean;
}

const env: IEnv = {
	SITE_URL: import.meta.env.SITE_URL || "",
	PROXY_URL: import.meta.env.PROXY_URL || "",
	DEV: import.meta.env.NODE_ENV === "development",
};

export default defineNuxtConfig({
	compatibilityDate: "2024-11-01",
	devtools: { enabled: env.DEV },

	runtimeConfig: {
		...env,
	},

	// Modules
	modules: [
		"@nuxtjs/i18n",
		"@nuxt/fonts",
		"@nuxtjs/sitemap",
		"@nuxtjs/robots",
		"@nuxt/ui",
		"@nuxt/image",
		"@pinia/nuxt",
		"@nuxt/scripts",
		"nuxt-charts",
	],

	nitro: {
		routeRules: {
			"/api/v2/**": {
				proxy: `${env.PROXY_URL}/**`,
			},
		},
	},

	// Router
	router: {
		options: {
			linkActiveClass: "_active-link",
			linkExactActiveClass: "_exact-link",
		},
	},

	routeRules: env.DEV
		? {}
		: {
				// Cached for 15 min
				"/api/*": {
					cache: {
						maxAge: 60 * 15,
					},
				},
			},

	// Sitemap
	site: {
		url: env.SITE_URL,
	},

	// Robots
	robots: getRobotsInfo(),

	// Image
	image: {
		quality: 80,
		format: ["webp"],
	},

	// i18n
	i18n: {
		baseUrl: process.env.SITE_URL,
		strategy: "no_prefix",
		defaultLocale: "en",
		detectBrowserLanguage: {
			fallbackLocale: "en",
			useCookie: true,
			redirectOn: "root",
		},
		locales: [
			{
				code: "en",
				iso: "en-US",
				name: "English",
				icon: "flag:us-4x3",
				isCatchallLocale: true,
			},
			{
				code: "ru",
				iso: "ru-Ru",
				name: "Русский",
				icon: "flag:ru-4x3",
			},
		],
		vueI18n: "./i18n.config.ts",
	},

	// Pinia
	pinia: {
		storesDirs: ["./store/**"],
	},

	// Style
	css: ["~/assets/css/main.css"],

	// AppConfig
	app: {
		head: headConfig,
		pageTransition: { name: "fade", mode: "out-in" },
		layoutTransition: { name: "fade", mode: "out-in" },
	},

	// Vite
	vite: {
		vue: {
			script: {
				propsDestructure: true,
			},
		},
	},
});
