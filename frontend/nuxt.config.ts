import headConfig from "./config/head.config.js";
import { prefix } from "./lib/api";

interface IEnv {
	SITE_URL: string;
	PROXY_URL: string;
	DEV: boolean;
}

const env: IEnv = {
	SITE_URL: process.env.SITE_URL || "http://localhost:3000",
	PROXY_URL: process.env.PROXY_URL || "http://localhost:8000",
	DEV: process.env.NODE_ENV === "development",
};

export default defineNuxtConfig({
	compatibilityDate: "2025-07-15",

	devtools: { enabled: env.DEV },

	runtimeConfig: {
		public: {
			...env,
		},
		...env,
	},

	vite: {
		server: {
			proxy: {
				[prefix]: {
					target: env.PROXY_URL,
					changeOrigin: true,
				},
			},
		},
	},

	// Modules
	modules: [
		"@nuxt/ui",
		"@nuxt/image",
		"@nuxt/fonts",
		"@pinia/nuxt",
		"@nuxtjs/i18n",
		"nuxt-charts",
	],

	// i18n
	i18n: {
		baseUrl: env.SITE_URL,
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

	// Image
	image: {
		quality: 80,
		format: ["webp"],
	},

	// Style
	css: ["~/assets/css/main.css"],

	// AppConfig
	app: {
		// @ts-ignore
		head: headConfig,
		pageTransition: { name: "fade", mode: "out-in" },
		layoutTransition: { name: "fade", mode: "out-in" },
	},
});
