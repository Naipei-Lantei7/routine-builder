import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// Writes the list of built files and a build id into sw.js, so the service worker
// can cache the whole app on install and replace the cache on each new build.
function precacheManifest(): Plugin {
  return {
    name: 'precache-manifest',
    apply: 'build',
    generateBundle(_options, bundle) {
      const sw = bundle['sw.js']
      if (!sw || sw.type !== 'chunk') return
      const files = Object.keys(bundle)
        .filter((file) => file.startsWith('assets/'))
        .map((file) => `/${file}`)
        .sort()
      const buildId = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12)

      // The minifier may change the quote style, so match any quote around the list.
      const manifest = /(["'`])__PRECACHE_MANIFEST__\1/
      if (!manifest.test(sw.code))
        this.error('Placeholder __PRECACHE_MANIFEST__ not found in sw.js')
      sw.code = sw.code.replace(manifest, JSON.stringify(files))

      // The id is plain hex and may be folded into other strings, so replace it as raw text.
      if (!sw.code.includes('__BUILD_ID__'))
        this.error('Placeholder __BUILD_ID__ not found in sw.js')
      sw.code = sw.code.replaceAll('__BUILD_ID__', buildId)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // Must come before the React plugin. Generates src/routeTree.gen.ts from src/routes.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    precacheManifest(),
  ],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        // The service worker must live at the site root (/sw.js) to control every page.
        sw: fileURLToPath(new URL('./src/sw/sw.ts', import.meta.url)),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    // UI tests drive full flows with userEvent (typing, routing); the 5s default is
    // too tight when the machine is busy.
    testTimeout: 15_000,
  },
})
