import { mount } from 'svelte'
import App from './App.svelte'
import { swUpdate } from './lib/swUpdate.svelte'
import './app.css'

/** Set per build in vite.config.ts; dist/sw.js carries the same value. */
declare const __BUILD_ID__: string

const target = document.getElementById('app')
if (!target) throw new Error('#app root element not found')
mount(App, { target })

// dev runs without a worker, so nothing stale is ever served from its cache
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void registerServiceWorker()
  })
}

async function registerServiceWorker(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.register('sw.js')

    // A new worker activates on its own (see sw.js). Pages are fetched
    // network-first, so a fresh load already runs the newest code — only offer
    // a reload when the worker that just took over belongs to a different
    // build than this page, i.e. the tab stayed open across a deploy. This
    // also keeps the very first install (no controller → controller) silent.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      void offerReloadIfOutdated()
    })

    // check for updates hourly
    setInterval(() => void reg.update().catch(() => {}), 60 * 60 * 1000)
  } catch {
    /* SW unavailable (e.g. plain http) — the app works without it */
  }
}

async function offerReloadIfOutdated(): Promise<void> {
  const worker = navigator.serviceWorker.controller
  if (!worker) return
  const build = await new Promise<string | null>((resolve) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = (event) => resolve(typeof event.data === 'string' ? event.data : null)
    worker.postMessage('GET_BUILD', [channel.port2])
    setTimeout(() => resolve(null), 3000)
  })
  if (build && build !== __BUILD_ID__) swUpdate.ready = true
}
