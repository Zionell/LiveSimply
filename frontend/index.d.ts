declare module "nuxt/app" {
	interface NuxtApp {
		$t: (key: string, ...args: any[]) => string;
	}
}
