FROM node:22-alpine
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN npm --prefix server ci
COPY lib ./lib
COPY types ./types
COPY server ./server
WORKDIR /app/server
ENV NODE_ENV=production
EXPOSE 4000
CMD ["npm", "start"]
