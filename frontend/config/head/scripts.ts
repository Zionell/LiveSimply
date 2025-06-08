const headScripts = [
	// Ya.Metrika
	{
		innerHTML: `
            (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
			m[i].l=1*new Date();
			for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
			k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
			(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

			ym(98558307, "init", {
				clickmap:true,
				trackLinks:true,
				accurateTrackBounce:true,
				webvisor:true
			});
        `,
	},
	// Google Tag Manager
	{
		src: "https://www.googletagmanager.com/gtag/js?id=G-BET6HMVQQX",
		async: true,
	},
	{
		innerHTML: `
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
				new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
				j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
				'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
			})(window,document,'script','dataLayer','GTM-WV84PFW9');
        `,
	},
];

const headNoScripts = [
	// Ya.Metrika
	{
		innerHTML:
			'<div><img src="https://mc.yandex.ru/watch/98558307" style="position:absolute; left:-9999px;" alt="" /></div>',
		body: true,
	},

	// Google Tag Manager (noscript)
	{
		innerHTML:
			'<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-WV84PFW9" height="0" width="0" style="display:none;visibility:hidden"></iframe>',
		body: true,
	},
];

export { headScripts, headNoScripts };
