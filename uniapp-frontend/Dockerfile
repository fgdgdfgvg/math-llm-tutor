FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build:h5

FROM nginx:alpine AS production

COPY --from=builder /app/dist/build/h5 /usr/share/nginx/html
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf

# nginx:alpine 镜像已自带 nginx 用户/组，只需把需要写入的目录授权给它
RUN mkdir -p /var/cache/nginx /var/log/nginx && \
    chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
