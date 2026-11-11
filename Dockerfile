FROM node:24-alpine
WORKDIR /app

RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY src ./src
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node

CMD ["node", "src/index.js"]