import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/index.ts'],
    exclude: ['tests/utils.ts'],
    timeout: 180000, // 3 minutes for PDF generation tests
    globals: true,
    environment: 'node',
  },
});