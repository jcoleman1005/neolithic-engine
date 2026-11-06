import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 300000,
    // Test files are independent (temp dirs, port 0), and each is CPU-bound sim work, so run them
    // in parallel across forked workers. VITEST_MAX_WORKERS overrides the default of cores - 1.
    pool: 'forks',
    fileParallelism: true,
    ...(process.env.VITEST_MAX_WORKERS ? { maxWorkers: Number(process.env.VITEST_MAX_WORKERS), minWorkers: 1 } : {}),
  },
});
