import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const resolvePath = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  root: resolvePath('.'),
  resolve: {
    alias: {
      '@bundle/core': resolvePath('../../packages/core/src/index.ts'),
      '@bundle/seesaw': resolvePath('../../games/seesaw/src/index.ts'),
      '@bundle/sky': resolvePath('../../games/sky/src/index.ts'),
      '@bundle/math': resolvePath('../../packages/math/src/index.ts'),
    },
  },
  build: {
    outDir: resolvePath('../../dist'),
    emptyOutDir: true,
  },
  // `npm run preview` serves the built bundle, which is what an iPad should be
  // testing before any of this is wrapped for the App Store.
  preview: {
    port: 4173,
  },
});
