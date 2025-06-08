interface Masks {
    [name: string]: string;
}

export const masks: Masks = {
    phone: "+7 ### ### ## ##",
};

interface Tokens {
    [name: string]: {
        pattern: RegExp;
        transform?: (v: string) => string;
    };
}

const tokens: Tokens = {
    "#": { pattern: /\d/ },
    S: { pattern: /[a-zA-Z]/ },
    A: { pattern: /[0-9a-zA-Z]/ },
    U: { pattern: /[a-zA-Z]/, transform: (v) => v.toLocaleUpperCase() },
    L: { pattern: /[a-zA-Z]/, transform: (v) => v.toLocaleLowerCase() },
};

export function applyMask(value: string, mask: string): string {
    let iMask = 0;
    let iValue = 0;
    let output = "";

    while (iMask < mask.length && iValue < value.length) {
        let cMask = mask[iMask];
        const masker = tokens[cMask];
        const cValue = value[iValue];
        if (masker) {
            if (masker.pattern.test(cValue)) {
                output += masker.transform ? masker.transform(cValue) : cValue;
                iMask++;
            }
            iValue++;
        } else {
            if (masker) {
                iMask++;
                cMask = mask[iMask];
            }
            output += cMask;

            if (cValue === cMask) {
                iValue++;
            }
            iMask++;
        }
    }

    return output;
}
