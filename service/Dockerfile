# Playwright base image ships Chromium + all OS deps
FROM mcr.microsoft.com/playwright:v1.54.0-jammy

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "src/server.js"]
