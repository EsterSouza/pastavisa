# syntax=docker/dockerfile:1
# Imagem de produção do pastavisa: Next em modo standalone, Postgres e Garage (S3).
# Quem publica é o workflow .github/workflows/imagem.yml; quem sobe é a stack
# `pastavisa/` do repo de infra.

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# O postinstall gera o Prisma Client pelo esquema que o DATABASE_URL indica;
# este valor só serve para escolher o do Postgres. Nada conecta nele no build.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:1/build
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
COPY scripts/generate-prisma.js ./scripts/
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
