import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Starting the local Workers runtime takes a few seconds.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
})
