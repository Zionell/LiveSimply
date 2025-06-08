import type { IBusinessCardLink } from "@/types/businessCard.ts";

const imagLib = [
	{ links: ["gmail"], icon: "gmail" },
	{ links: ["inst"], icon: "inst" },
	{ links: ["linkedin"], icon: "linkedin" },
	{ links: ["twitter"], icon: "twitter" },
	{ links: ["github"], icon: "github" },
	{ links: ["t.me", "tg"], icon: "tg" },
	{ links: ["wa.me", "whatsapp"], icon: "whatsapp" },
	{ links: ["youtube"], icon: "youtube" },
	{ links: ["askarov"], icon: "askarov" },
];

export function getImageByLink(link: string): string {
	if (!link) {
		return "";
	}
	const foundLink = imagLib.find((image) =>
		image.links.some((subLink) => link.includes(subLink)),
	);

	if (foundLink) {
		return `/images/social/${foundLink.icon}.svg`;
	}

	const favicon = `https://s2.googleusercontent.com/s2/favicons?domain_url=${link}`;
	return favicon || "";
}

export function getImage(item: IBusinessCardLink): string {
	if (item?.icon) {
		return item.icon;
	}

	return getImageByLink(item.link);
}
