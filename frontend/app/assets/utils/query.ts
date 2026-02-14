export type ChoiceValue = string | number | boolean | null | [];

export interface RangeValue {
    min: number | null;
    max: number | null;
}

export function objectToQuery(obj: any): string {
    let qs = "?";

    for (const name in obj) {
        if (obj[name] || obj[name] === 0 || obj[name] === false) {
            if (Array.isArray(obj[name])) {
                if ((obj[name] as ChoiceValue[]).length) {
                    qs += `${name}=${obj[name]}&`;
                }
            } else if (typeof obj[name] === "object" && obj[name] !== null) {
                qs += (obj[name] as RangeValue)?.min
                    ? `${name}_0=${(obj[name] as RangeValue).min}&`
                    : "";
                qs += (obj[name] as RangeValue)?.max
                    ? `${name}_1=${(obj[name] as RangeValue).max}&`
                    : "";
            } else {
                qs += `${name}=${obj[name]}&`;
            }
        }
    }
    return qs.slice(0, -1);
}
