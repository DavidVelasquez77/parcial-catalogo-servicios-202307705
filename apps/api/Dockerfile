FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json apps/api/
RUN npm install
COPY apps/api apps/api
COPY database database
RUN npm run build --workspace apps/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/database ./database
RUN mkdir -p /app/data
COPY CatalogoServicios.xlsx /app/data/CatalogoServicios.xlsx
EXPOSE 3000
CMD ["sh", "-c", "node apps/api/dist/scripts/migrate.js && node apps/api/dist/main.js"]
