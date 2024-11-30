FROM oven/bun:1-alpine as base
WORKDIR /app

RUN apk add --no-cache git

COPY package.json ./
COPY bun.lockb ./
RUN bun install

COPY tsconfig.json ./

CMD ["bun", "src/index.ts"]