import { defineConfig } from 'vitest/config'

// Pin the time zone so local-time logic (including daylight-saving days) is
// tested the same way on every machine. Workers inherit this from the main process.
process.env.TZ = 'America/New_York'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
