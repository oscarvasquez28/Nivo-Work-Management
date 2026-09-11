# syntax=docker/dockerfile:1
FROM node:22.12.0-alpine AS deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm install -g npm@11.10.1 && npm ci

FROM node:22.12.0-alpine AS runner
WORKDIR /app/server
ENV NODE_ENV=production
COPY package.json /app/package.json
COPY --from=deps /app/server/node_modules ./node_modules
RUN ln -s /app/server/node_modules /app/node_modules
COPY server .
COPY lib /app/lib
COPY types /app/types
ENV HOST=0.0.0.0
EXPOSE 4000
CMD ["sh", "-c", "npm run migrate && npm start"]
