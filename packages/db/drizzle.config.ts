import { defineConfig } from 'drizzle-kit'

// Generates SQL migrations from src/schema.ts. Wrangler applies them to D1
// (see apps/api/wrangler.jsonc, migrations_dir).
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/schema.ts',
  out: './migrations',
})
