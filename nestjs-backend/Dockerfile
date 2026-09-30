FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
# 构建阶段必须装 devDependencies（@nestjs/cli、typescript 都在其中），
# 否则 npm run build 会以 “nest: not found” 失败。
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS production

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

COPY package*.json ./
# 运行阶段只装生产依赖，避免把 nest CLI 等构建工具打进镜像
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# 应用运行时会写入这些目录（Lean 证明工作区、场景配置），提前建好并授权，
# 否则以非 root 用户启动会因 mkdir EACCES 反复重启
RUN mkdir -p /app/lean_workspace /app/config/scenarios && \
    chown -R nestjs:nodejs /app/lean_workspace /app/config

USER nestjs

EXPOSE 3000

# 用 127.0.0.1：容器内 localhost 会优先解析成 ::1，而 Node 只监听 IPv4，
# 用 localhost 做健康检查会一直是 Connection refused
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health || exit 1

CMD ["node", "dist/main.js"]
