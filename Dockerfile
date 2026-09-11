# syntax=docker/dockerfile:1
FROM node:22.12.0-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install -g npm@11.10.1 && npm ci --ignore-scripts
COPY . .
ARG NIVO_API_URL=http://127.0.0.1:4000
ENV NIVO_API_URL=$NIVO_API_URL
RUN npm run build
RUN npm prune --omit=dev --ignore-scripts

FROM node:22.12.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
ENV PORT=3000
CMD ["sh", "-c", "npx next start -H 0.0.0.0 -p ${PORT:-3000}"]
