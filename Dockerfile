FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS production
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
WORKDIR /app
COPY package*.json ./
RUN npm ci --frozen-lockfile --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
USER nestjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD wget -q --spider http://localhost:3000/api/v1/health || exit 1
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
