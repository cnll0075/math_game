import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const resolvePath = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  root: resolvePath('.'),
  resolve: {
    alias: {
      '@bundle/core': resolvePath('../../packages/core/src/index.ts'),
      '@bundle/seesaw': resolvePath('../../games/seesaw/src/index.ts'),
    },
  },
  build: {
    outDir: resolvePath('../../dist'),
    emptyOutDir: true,
  },
});
