import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 20000,
    hookTimeout: 20000,
    sequence: { concurrent: false },
    fileParallelism: false, // test files share one database
  },
})
