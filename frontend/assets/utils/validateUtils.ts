/* eslint-disable no-mixed-operators */
export const regex = {
    cyrillic: /^[а-яё\s-]+$/i,
    latin: /^[a-z\s]+$/i,
    multilang: /^[а-яёa-z\s]+[а-яёa-z-().'\s][а-яёa-z\s]+$/i,
    text: /^[а-яёa-z0-9,\s-./&""]+$/i,
    numbers: /^\d+(\.\d+)?$/g,
    date: /^\d{2}\/\d{2}\/\d{4}$/,
    year: /^\d{4}$/,
    time: /^(([0-1]{0,1}[0-9])|(2[0-3])):[0-5]{0,1}[0-9]$/,
    phone: /^\+7\s[0-9]{3}\s[0-9]{3}\s[0-9]{2}\s[0-9]{2}$/,
    email: /^[a-z0-9./=?_-]{1,63}@[a-z0-9-]{1,63}\.[a-z]{2,6}$/i,
    password: /^.*(?=.{8,})(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).*$/,
    address: /^[а-яёa-z0-9\s-.,/&""()]+$/i,
    innCommercial: /^[0-9]{10}$/,
};

export const errorMessages = {
    common: "Wrong format",
    required: "Field is required",
    email: "Invalid email address",
    min: (num: number) => `Must be ${num} or more characters long`,
    max: (num: number) => `Must be ${num} or fewer characters long`,
    cyrillic: "Use only cyrillic",
    multilang: "Use only letters",
    numbers: "Use only numbers",
    password:
        "The password must contain: upper and lowercase Latin letters, numbers",
};
