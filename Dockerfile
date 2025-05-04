FROM node:22-alpine

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-cjk

WORKDIR /app

COPY package.json package-lock.json ./

COPY . ./

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN npm ci && npm run build

ENTRYPOINT ["/app/dist/bin/index.js"]
