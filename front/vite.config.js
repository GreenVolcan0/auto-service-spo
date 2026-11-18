import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Конфигурация Vite.
// Dev-сервер работает на порту 3000 — он совпадает с CORS-списком бэкенда
// (CORS_ORIGINS в docker-compose) и с портом сервиса front в docker-compose.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
  },
  // Тесты утилит (vitest) запускаются в окружении node, DOM не нужен.
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
