FROM node:22.18-alpine

ARG SITE_URL
ENV SITE_URL=$SITE_URL
ARG PROXY_URL
ENV PROXY_URL=$PROXY_URL

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN chmod +x entrypoint.production.sh
RUN npm run build

CMD ["node", ".output/server/index.mjs"]
