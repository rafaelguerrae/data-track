# Build a partir da raiz do monorepo: docker build -f apps/api/Dockerfile .
FROM node:24-slim
RUN corepack enable
WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @data-track/shared build \
  && pnpm --filter @data-track/api build

ENV NODE_ENV=production
WORKDIR /app/apps/api
EXPOSE 3001
# Aplica as migrations e sobe a API
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
