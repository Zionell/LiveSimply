import html2canvas from "html2canvas-pro";

export const exceptItemFromObj = (obj: { [key: string]: any }, key: string) => {
	let { [key]: _, ...rest } = obj;
	return rest;
};

export const capitalizeFirstLetter = (string: string): string => {
	return string.charAt(0).toUpperCase() + string.slice(1);
};

export function copyLink(text: string): void {
	const inp = document.createElement("input");

	inp.value = text;
	document.body.appendChild(inp);
	inp.select();

	if (!document.execCommand("copy")) {
		console.warn("Error/CopyLink");
	}
	document.body.removeChild(inp);
}

export function capture(id: string) {
	const htmlItem = document.getElementById(id);
	if (!htmlItem) {
		console.warn("Element not found");
		return;
	}
	htmlItem.style.borderRadius = "0";

	html2canvas(htmlItem).then((canvas) => {
		const imgData = canvas.toDataURL("image/png");

		// Создаем ссылку для скачивания изображения
		const downloadLink = document.createElement("a");
		downloadLink.href = imgData;
		downloadLink.download = "livesimply.png";

		// Добавляем ссылку на страницу и симулируем клик для скачивания
		document.body.appendChild(downloadLink);
		downloadLink.click();
		document.body.removeChild(downloadLink);
	});
}

export function colorByPercent(percentage: number) {
	if (percentage < 30) return UiColors.error;
	if (percentage < 60) return UiColors.warning;
	return UiColors.success;
}
