import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.ts'],
    exclude: ['tests/utils.ts'], // This file contains helper functions, not tests
    timeout: 180000, // 3 minutes for PDF generation tests
    globals: true,
    environment: 'node',
  },
});