# Playwright base image ships Chromium + all OS deps.
# IMPORTANT: base image tag must match the pinned playwright version in package.json.
FROM mcr.microsoft.com/playwright:v1.62.0-jammy

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "src/server.js"]
