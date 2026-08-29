FROM oven/bun:1.3.14-alpine AS base
WORKDIR /app

COPY package.json ./
COPY bun.lockb ./
RUN bun install

COPY tsconfig.json ./

CMD ["bun", "src/index.ts"]
