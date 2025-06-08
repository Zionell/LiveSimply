import { NextRequest } from "next/server";
import { i18n, Locale } from "@/i18n-config";
import Negotiator from "negotiator";
import { match as matchLocale } from "@formatjs/intl-localematcher";
import { capitalizeFirstLetter } from "@/utils/common";
import { IExchangeItem } from "@/types/financeTypes";

export function getLocale(request: NextRequest): string {
    const negotiatorHeaders: Record<string, string> = {};
    request.headers.forEach((value, key) => (negotiatorHeaders[key] = value));

    // @ts-ignore locales are readonly
    const locales: string[] = i18n.locales;

    let languages = new Negotiator({ headers: negotiatorHeaders }).languages(
        locales,
    );

    const locale = matchLocale(languages, locales, i18n.defaultLocale);

    return locale;
}

export function sortArrByLang<T extends Record<string, any>>(
    lang: Locale,
    arr: T[],
): T[] {
    const prefix = capitalizeFirstLetter(lang);
    const labelKey = `label${prefix}` as keyof T;

    return arr.sort((a: T, b: T) =>
        String(a[labelKey]).localeCompare(String(b[labelKey])),
    );
}

export function getLabelByLang<T extends Record<string, any>>(
    lang: Locale,
    item: T,
): string {
    const prefix = capitalizeFirstLetter(lang);
    const labelKey = `label${prefix}` as keyof T;

    if (labelKey in item) {
        return capitalizeFirstLetter(item[labelKey]);
    } else {
        // Обработка случая, когда свойство не найдено
        return "";
    }
}
