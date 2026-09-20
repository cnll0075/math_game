import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const resolvePath = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@bundle/core': resolvePath('./packages/core/src/index.ts'),
      '@bundle/seesaw': resolvePath('./games/seesaw/src/index.ts'),
      '@bundle/sky': resolvePath('./games/sky/src/index.ts'),
      '@bundle/math': resolvePath('./packages/math/src/index.ts'),
      '@bundle/bramble': resolvePath('./games/bramble/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['{packages,games,apps}/*/src/**/*.test.ts'],
  },
});
