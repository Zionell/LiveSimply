# ---------- BUILD ----------
FROM node:22.18-alpine AS build

ARG SITE_URL
ENV SITE_URL=$SITE_URL
ARG PROXY_URL
ENV PROXY_URL=$PROXY_URL

WORKDIR /app

COPY package*.json ./

RUN npm i

COPY . .

RUN npm run build


# ---------- RUNTIME ----------
FROM node:22.18-alpine

WORKDIR /app

COPY --from=build /app/.output ./.output

CMD ["node", ".output/server/index.mjs"]
