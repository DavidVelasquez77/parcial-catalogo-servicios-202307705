FROM mcr.microsoft.com/playwright:v1.52.0-noble
WORKDIR /work
COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/
RUN npm ci
COPY playwright.config.ts ./
COPY e2e e2e
CMD ["npx", "playwright", "test", "--config=playwright.config.ts"]
