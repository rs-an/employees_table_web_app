FROM node:24-bookworm-slim
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --chown=node:node app.js ./
COPY --chown=node:node public ./public
COPY --chown=node:node views ./views
USER node
EXPOSE 3000
CMD ["node", "app.js"]
