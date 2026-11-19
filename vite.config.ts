import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// the commit in CI, so re-running a deploy of the same commit doesn't prompt a reload
const BUILD_ID = process.env.GITHUB_SHA?.slice(0, 12) ?? `local-${Date.now().toString(36)}`

/**
 * Stamps the build id and the hashed bundle files into dist/sw.js. Without
 * this the worker is byte-identical across deploys, so browsers never install
 * a new one — no update prompt, and old assets pile up in its cache forever.
 */
function swManifest(): Plugin {
  let outDir = ''
  let assetsDir = ''
  return {
    name: 'sw-manifest',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
      assetsDir = config.build.assetsDir
    },
    writeBundle(_, bundle) {
      const file = resolve(outDir, 'sw.js')
      const src = readFileSync(file, 'utf8')
      const buildMarker = `'__BUILD_ID__'`
      const precacheMarker = '/*__PRECACHE__*/[]'
      if (!src.includes(buildMarker) || !src.includes(precacheMarker)) {
        throw new Error('sw-manifest: placeholders missing from public/sw.js')
      }
      const assets = Object.keys(bundle).filter((name) => name.startsWith(`${assetsDir}/`)).sort()
      writeFileSync(
        file,
        src.replace(buildMarker, JSON.stringify(BUILD_ID)).replace(precacheMarker, JSON.stringify(assets))
      )
    }
  }
}

export default defineConfig({
  base: './',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [svelte(), swManifest()],
})
