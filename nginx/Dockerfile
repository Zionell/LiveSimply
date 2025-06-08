FROM nginx:1.25-alpine

ENV ENVIRONMENT=development
ENV TLS_MODE=off
ENV SITE_HOST=localhost

EXPOSE 80/tcp 443/tcp

RUN apk upgrade && \
    apk add --no-cache esh curl openssl && \
    curl https://get.acme.sh | sh && \
    ln -s  /root/.acme.sh/acme.sh  /usr/local/bin/acme.sh && \
    rm /etc/nginx/conf.d/default.conf

COPY nginx.conf.esh ssl_params backend frontend /etc/nginx/

CMD ["/bin/sh", "-c", "esh -o /etc/nginx/conf.d/nginx.conf /etc/nginx/nginx.conf.esh && exec nginx -g 'daemon off;'"]
