import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: './',
  plugins: [preact()],
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/gsap')) return 'gsap';
          if (id.includes('@solana') || id.includes('bs58') || id.includes('@noble')) return 'web3';
          if (id.includes('/src/cards/')) return 'cards';
          return undefined;
        },
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/lease/**', 'src/chain/memo.ts'],
      thresholds: { lines: 100, functions: 100, statements: 100, branches: 95 },
    },
  },
});
