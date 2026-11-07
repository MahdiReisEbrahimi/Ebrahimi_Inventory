import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Independent PostgreSQL fixtures can still conflict on Serializable predicate locks.
    fileParallelism: false,
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
