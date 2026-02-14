export default defineNuxtPlugin(async () => {
	await useMainStore().nuxtServerInit();
});
