import { useMainStore } from "~/store";

export default defineNuxtPlugin(async () => {
	await useMainStore().nuxtServerInit();
});
