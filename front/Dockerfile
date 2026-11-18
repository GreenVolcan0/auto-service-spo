# Сборка статики фронтенда и раздача через nginx.
# Двухстадийная сборка: node для vite build, nginx для раздачи dist/.

FROM node:20-alpine AS build
WORKDIR /app

# Сначала только манифесты — слой с зависимостями кешируется
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
